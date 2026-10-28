import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAuthorized, checkAuthority } from "@/lib/authz";
import { recordAudit } from "@/lib/audit/audit";
import { ConflictError, ForbiddenError, InputError, NotFoundError } from "@/lib/errors";
import { dec, money } from "@/lib/money";
import { assertTransition } from "@/lib/lifecycle/state-machine";
import { nextReference } from "@/lib/ids";
import { priceQuote } from "@/lib/pricing/engine";
import type { PricingInput } from "@/lib/pricing/types";
import type { EndorsementInput } from "@/lib/validation/schemas";
import { dateOnly } from "./mappers";
import type { Actor } from "./quote-service";

export const endorsementInclude = {
  policy: { include: { applicant: true, product: true } },
} satisfies Prisma.EndorsementInclude;

interface EndorsementChanges {
  before: { coverageLimit: string; premium: string; assetValue?: string };
  after: { coverageLimit: string; premium: string; assetValue?: string };
  coverageCode?: string;
  newLimit?: string;
  newAssetValue?: string;
  pricingDecision: string;
  pricingReasons: string[];
}

/**
 * Creates a mid-term change request. The policy record itself is untouched until
 * an authorised reviewer applies the endorsement, so original history is kept.
 */
export async function createEndorsement(raw: EndorsementInput, actor: Actor) {
  assertAuthorized(actor.role, "endorsement:submit");

  const policy = await prisma.policy.findUnique({
    where: { id: raw.policyId },
    include: { quote: true, asset: true },
  });
  if (!policy) throw new NotFoundError("Policy", raw.policyId);
  if (policy.status !== "ACTIVE") {
    throw new ConflictError(`Only ACTIVE policies can be endorsed; ${policy.reference} is ${policy.status}.`);
  }

  const effective = dateOnly(raw.effectiveDate);
  if (effective < policy.effectiveFrom || effective > policy.effectiveTo) {
    throw new InputError(
      `Endorsement effective date ${raw.effectiveDate} must fall inside the policy term ${policy.effectiveFrom
        .toISOString()
        .slice(0, 10)}..${policy.effectiveTo.toISOString().slice(0, 10)}.`,
    );
  }

  const snapshot = (policy.quote.pricingBreakdown as unknown as { inputSnapshot: PricingInput }).inputSnapshot;
  if (!snapshot) throw new ConflictError("Policy quote has no pricing snapshot and cannot be repriced.");

  const modified: PricingInput = structuredClone(snapshot);
  let coverageCode = raw.coverageCode ?? modified.requestedCoverages[0]?.code;

  if (raw.type === "COVERAGE_UPDATE") {
    if (!raw.coverageCode) throw new InputError("coverageCode is required for a coverage update.");
    if (!modified.requestedCoverages.some((c) => c.code === raw.coverageCode)) {
      throw new InputError(`Coverage ${raw.coverageCode} is not part of this policy.`);
    }
    coverageCode = raw.coverageCode;
  }

  if (raw.type === "LIMIT_CHANGE" || raw.type === "COVERAGE_UPDATE") {
    if (!raw.newLimit) throw new InputError("newLimit is required for a limit change.");
    if (!coverageCode) throw new InputError("coverageCode is required to change a limit.");
    const target = modified.requestedCoverages.find((c) => c.code === coverageCode);
    if (!target) throw new InputError(`Coverage ${coverageCode} is not part of this policy.`);
    target.limit = raw.newLimit;
  }

  if (raw.type === "ASSET_UPDATE") {
    if (!raw.newAssetValue) throw new InputError("newAssetValue is required for an asset update.");
    if (!modified.asset) throw new InputError("This policy has no insured asset to update.");
    modified.asset.currentValue = raw.newAssetValue;
  }

  const repriced = priceQuote(modified);
  if (repriced.decision === "INELIGIBLE") {
    throw new InputError(
      `Endorsement rejected by eligibility rules: ${repriced.reasons
        .filter((r) => r.category !== "PRICING")
        .map((r) => r.message)
        .join(" ")}`,
      repriced.reasons,
    );
  }

  const newPremium = repriced.breakdown.grossPremium;
  const delta = money(dec(newPremium).minus(dec(policy.premium)));
  const changes: EndorsementChanges = {
    before: {
      coverageLimit: policy.coverageLimit.toString(),
      premium: policy.premium.toString(),
      assetValue: policy.asset?.currentValue.toString(),
    },
    after: {
      coverageLimit: repriced.totalCoverageLimit,
      premium: newPremium,
      assetValue: modified.asset?.currentValue,
    },
    coverageCode,
    newLimit: raw.newLimit,
    newAssetValue: raw.newAssetValue,
    pricingDecision: repriced.decision,
    pricingReasons: repriced.reasons.filter((r) => r.severity !== "INFO").map((r) => r.message),
  };

  return prisma.$transaction(async (tx) => {
    const endorsement = await tx.endorsement.create({
      data: {
        reference: await nextReference(tx, "END"),
        policyId: policy.id,
        type: raw.type,
        status: "PENDING",
        effectiveDate: effective,
        reason: raw.reason,
        requestedChanges: changes as unknown as Prisma.InputJsonValue,
        premiumDelta: delta,
      },
    });

    await recordAudit(tx, {
      entityType: "Endorsement",
      entityId: endorsement.id,
      entityRef: endorsement.reference,
      action: "ENDORSEMENT_REQUESTED",
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `${raw.type} requested on policy ${policy.reference}; premium delta ${delta}.`,
      payload: { policyReference: policy.reference, changes: changes as unknown as Prisma.InputJsonValue },
    });

    return tx.endorsement.findUniqueOrThrow({ where: { id: endorsement.id }, include: endorsementInclude });
  });
}

/** Approves (applies) or rejects a pending endorsement. */
export async function decideEndorsement(
  input: { endorsementId: string; action: "APPROVE" | "REJECT"; notes: string },
  actor: Actor,
) {
  assertAuthorized(actor.role, "endorsement:decide");
  const endorsement = await prisma.endorsement.findUnique({
    where: { id: input.endorsementId },
    include: { policy: { include: { asset: true } } },
  });
  if (!endorsement) throw new NotFoundError("Endorsement", input.endorsementId);
  if (endorsement.status !== "PENDING") {
    throw new ConflictError(`Endorsement ${endorsement.reference} is already ${endorsement.status}.`);
  }

  if (input.action === "APPROVE") {
    const authority = checkAuthority(actor.role, dec(endorsement.premiumDelta).abs());
    if (!authority.allowed) throw new ForbiddenError(authority.reason ?? "Insufficient authority.");
  }

  const changes = endorsement.requestedChanges as unknown as EndorsementChanges;

  return prisma.$transaction(async (tx) => {
    if (input.action === "REJECT") {
      assertTransition("endorsement", "PENDING", "REJECTED");
      const rejected = await tx.endorsement.update({
        where: { id: endorsement.id },
        data: {
          status: "REJECTED",
          approvedBy: actor.actorId,
          approvedByRole: actor.role,
          decidedAt: new Date(),
          rejectionReason: input.notes,
        },
      });
      await recordAudit(tx, {
        entityType: "Endorsement",
        entityId: endorsement.id,
        entityRef: endorsement.reference,
        action: "ENDORSEMENT_REJECTED",
        actorRole: actor.role,
        actorId: actor.actorId,
        summary: `Endorsement ${endorsement.reference} rejected: ${input.notes}`,
      });
      return rejected;
    }

    assertTransition("endorsement", "PENDING", "APPROVED");
    assertTransition("endorsement", "APPROVED", "APPLIED");

    const approved = await tx.endorsement.update({
      where: { id: endorsement.id },
      data: {
        status: "APPROVED",
        approvedBy: actor.actorId,
        approvedByRole: actor.role,
        decidedAt: new Date(),
        rejectionReason: null,
      },
    });

    await tx.policy.update({
      where: { id: endorsement.policyId },
      data: {
        premium: changes.after.premium,
        coverageLimit: changes.after.coverageLimit,
        version: { increment: 1 },
      },
    });

    if (endorsement.type === "ASSET_UPDATE" && endorsement.policy.asset && changes.newAssetValue) {
      await tx.insuredAsset.update({
        where: { id: endorsement.policy.asset.id },
        data: { currentValue: changes.newAssetValue, updatedAt: new Date() },
      });
    }

    const applied = await tx.endorsement.update({
      where: { id: approved.id },
      data: { status: "APPLIED" },
    });

    await recordAudit(tx, {
      entityType: "Endorsement",
      entityId: endorsement.id,
      entityRef: endorsement.reference,
      action: "ENDORSEMENT_APPLIED",
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `Endorsement ${endorsement.reference} applied to policy ${endorsement.policy.reference}: premium ${changes.before.premium} -> ${changes.after.premium}.`,
      payload: { changes: changes as unknown as Prisma.InputJsonValue, notes: input.notes },
    });

    return applied;
  });
}

export async function listEndorsements(filters: { page: number; pageSize: number; status?: string }) {
  const where: Prisma.EndorsementWhereInput = filters.status ? { status: filters.status as never } : {};
  const [items, total] = await Promise.all([
    prisma.endorsement.findMany({
      where,
      include: { policy: { include: { applicant: true, product: true } } },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.endorsement.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getEndorsement(idOrRef: string) {
  return prisma.endorsement.findFirst({
    where: { OR: [{ id: idOrRef }, { reference: idOrRef }] },
    include: endorsementInclude,
  });
}
