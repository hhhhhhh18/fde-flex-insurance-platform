import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAuthorized, checkAuthority } from "@/lib/authz";
import { recordAudit } from "@/lib/audit/audit";
import { ConflictError, ForbiddenError, InputError, NotFoundError } from "@/lib/errors";
import { dec } from "@/lib/money";
import { assertTransition } from "@/lib/lifecycle/state-machine";
import { nextReference } from "@/lib/ids";
import type { PolicyIssueInput } from "@/lib/validation/schemas";
import { addMonths, dateOnly } from "./mappers";
import type { Actor } from "./quote-service";

export const policyInclude = {
  applicant: true,
  product: true,
  asset: true,
  quote: { include: { underwriting: { orderBy: { createdAt: "desc" } } } },
  endorsements: { orderBy: { createdAt: "desc" } },
  renewals: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.PolicyInclude;

export type PolicyWithRelations = Prisma.PolicyGetPayload<{ include: typeof policyInclude }>;

/**
 * Policy issuance prerequisites (all enforced server-side):
 *  - quote exists, is EVALUATED and not expired
 *  - quote is ELIGIBLE, or REFERRED with a recorded underwriting APPROVAL
 *  - premium payment is confirmed
 *  - actor has policy:issue permission and monetary authority for the premium
 *  - no unexplained overlap with an existing live policy for the same asset
 */
export async function issuePolicy(raw: PolicyIssueInput, actor: Actor, now: Date = new Date()): Promise<PolicyWithRelations> {
  assertAuthorized(actor.role, "policy:issue");

  const quote = await prisma.quote.findUnique({
    where: { id: raw.quoteId },
    include: { underwriting: { orderBy: { createdAt: "desc" } }, policy: true },
  });
  if (!quote) throw new NotFoundError("Quote", raw.quoteId);
  if (quote.policy) throw new ConflictError(`Quote ${quote.reference} has already been issued as ${quote.policy.reference}.`);
  if (quote.status !== "EVALUATED") {
    throw new ConflictError(`Quote ${quote.reference} is ${quote.status} and cannot be issued.`);
  }

  if (quote.expiresAt < now) throw new ConflictError(`Quote ${quote.reference} expired on ${quote.expiresAt.toISOString().slice(0, 10)}.`);
  if (!raw.paymentConfirmed) {
    throw new InputError("Premium payment must be confirmed before a policy can be issued.");
  }

  if (quote.decision === "INELIGIBLE" || quote.decision === "AWAITING_INFORMATION") {
    throw new ConflictError(`Quote ${quote.reference} is ${quote.decision} and cannot be bound.`);
  }
  if (quote.decision === "REFERRED") {
    const approval = quote.underwriting.find((u) => u.status === "APPROVED");
    if (!approval) {
      throw new ForbiddenError(
        `Quote ${quote.reference} is referred for underwriting; an authorised reviewer approval is required before issuance.`,
        { quoteId: quote.id, underwriting: quote.underwriting.map((u) => ({ reference: u.reference, status: u.status })) },
      );
    }
    const approvalAuthority = checkAuthority(approval.reviewerRole ?? "RISK_REVIEWER", quote.grossPremium);
    if (!approvalAuthority.allowed) {
      throw new ForbiddenError(`Reviewer approval does not cover this premium. ${approvalAuthority.reason}`);
    }
  }

  const authority = checkAuthority(actor.role, quote.grossPremium);
  if (!authority.allowed) throw new ForbiddenError(authority.reason ?? "Insufficient authority.");

  const effectiveFrom = raw.effectiveFrom ?? now.toISOString().slice(0, 10);
  const effectiveTo = addMonths(effectiveFrom, raw.termMonths);

  return prisma.$transaction(async (tx) => {
    if (quote.assetId) {
      const overlapping = await tx.policy.findFirst({
        where: {
          assetId: quote.assetId,
          status: { in: ["ACTIVE", "PENDING_PAYMENT"] },
          effectiveFrom: { lte: dateOnly(effectiveTo) },
          effectiveTo: { gte: dateOnly(effectiveFrom) },
        },
      });
      if (overlapping) {
        throw new ConflictError(
          `Asset already has live coverage (${overlapping.reference}) for part of ${effectiveFrom}..${effectiveTo}.`,
        );
      }
    }

    const reference = await nextReference(tx, "POL", now);
    const policy = await tx.policy.create({
      data: {
        reference,
        quoteId: quote.id,
        applicantId: quote.applicantId,
        productId: quote.productId,
        assetId: quote.assetId,
        status: "PENDING_PAYMENT",
        paymentStatus: "PAID",
        effectiveFrom: dateOnly(effectiveFrom),
        effectiveTo: dateOnly(effectiveTo),
        premium: quote.grossPremium,
        coverageLimit: quote.coverageLimit,
        issuedByRole: actor.role,
        issuedBy: actor.actorId,
      },
    });

    await recordAudit(tx, {
      entityType: "Policy",
      entityId: policy.id,
      entityRef: policy.reference,
      action: "POLICY_CREATED",
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `Policy ${policy.reference} created from quote ${quote.reference} in PENDING_PAYMENT.`,
      payload: { quoteId: quote.id, premium: quote.grossPremium, effectiveFrom, effectiveTo },
    });

    assertTransition("policy", "PENDING_PAYMENT", "ACTIVE");
    const active = await tx.policy.update({
      where: { id: policy.id },
      data: { status: "ACTIVE", version: { increment: 1 } },
    });

    await tx.quote.update({ where: { id: quote.id }, data: { status: "ACCEPTED" } });

    await recordAudit(tx, {
      entityType: "Policy",
      entityId: policy.id,
      entityRef: policy.reference,
      action: "POLICY_ACTIVATED",
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `Policy ${policy.reference} activated after premium payment ${raw.paymentReference ?? "(reference not supplied)"}.`,
      payload: { paymentStatus: "PAID", premium: quote.grossPremium },
    });

    return tx.policy.findUniqueOrThrow({ where: { id: active.id }, include: policyInclude });
  });
}

/** Activates a policy that is awaiting payment (e.g. an accepted renewal). */
export async function activatePolicy(
  input: { policyId: string; paymentReference?: string },
  actor: Actor,
): Promise<PolicyWithRelations> {
  assertAuthorized(actor.role, "policy:issue");
  const policy = await prisma.policy.findUnique({ where: { id: input.policyId } });
  if (!policy) throw new NotFoundError("Policy", input.policyId);
  if (policy.status !== "PENDING_PAYMENT") {
    throw new ConflictError(`Policy ${policy.reference} is ${policy.status}, not PENDING_PAYMENT.`);
  }
  const authority = checkAuthority(actor.role, policy.premium);
  if (!authority.allowed) throw new ForbiddenError(authority.reason ?? "Insufficient authority.");

  return prisma.$transaction(async (tx) => {
    assertTransition("policy", policy.status, "ACTIVE");
    const updated = await tx.policy.update({
      where: { id: policy.id },
      data: { status: "ACTIVE", paymentStatus: "PAID", version: { increment: 1 } },
    });
    await recordAudit(tx, {
      entityType: "Policy",
      entityId: policy.id,
      entityRef: policy.reference,
      action: "POLICY_ACTIVATED",
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `Policy ${policy.reference} activated after payment confirmation.`,
      payload: { paymentReference: input.paymentReference ?? null },
    });
    return tx.policy.findUniqueOrThrow({ where: { id: updated.id }, include: policyInclude });
  });
}

export async function cancelPolicy(
  input: { policyId: string; reason: string; effectiveDate?: string },
  actor: Actor,
  at: Date = new Date(),
): Promise<PolicyWithRelations> {
  assertAuthorized(actor.role, "policy:cancel");
  const policy = await prisma.policy.findUnique({ where: { id: input.policyId } });
  if (!policy) throw new NotFoundError("Policy", input.policyId);

  return prisma.$transaction(async (tx) => {
    assertTransition("policy", policy.status, "CANCELLED");
    const cancelled = await tx.policy.update({
      where: { id: policy.id },
      data: {
        status: "CANCELLED",
        cancelledAt: at,
        cancellationReason: input.reason,
        version: { increment: 1 },
      },
    });
    await recordAudit(tx, {
      entityType: "Policy",
      entityId: policy.id,
      entityRef: policy.reference,
      action: "POLICY_CANCELLED",
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `Policy ${policy.reference} cancelled: ${input.reason}`,
      payload: { previousStatus: policy.status, effectiveDate: input.effectiveDate ?? null },
    });
    return tx.policy.findUniqueOrThrow({ where: { id: cancelled.id }, include: policyInclude });
  });
}
export async function listPolicies(filters: {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
}) {
  const where: Prisma.PolicyWhereInput = {};
  if (filters.status) where.status = filters.status as never;
  if (filters.q) {
    where.OR = [
      { reference: { contains: filters.q, mode: "insensitive" } },
      { applicant: { lastName: { contains: filters.q, mode: "insensitive" } } },
      { applicant: { firstName: { contains: filters.q, mode: "insensitive" } } },
      { product: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.policy.findMany({
      where,
      include: {
        applicant: { select: { firstName: true, lastName: true, reference: true } },
        product: { select: { name: true, code: true } },
        asset: { select: { reference: true, assetType: true } },
      },
      orderBy: { issuedAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.policy.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getPolicy(idOrRef: string): Promise<PolicyWithRelations | null> {
  return prisma.policy.findFirst({
    where: { OR: [{ id: idOrRef }, { reference: idOrRef }] },
    include: policyInclude,
  });
}

/** Marks a policy EXPIRED when its term has ended (scheduled or generator use). */
export async function expirePolicy(policyId: string, actor: Actor, at: Date = new Date()) {
  const policy = await prisma.policy.findUnique({ where: { id: policyId } });
  if (!policy) throw new NotFoundError("Policy", policyId);
  if (policy.status === "EXPIRED") return policy;
  return prisma.$transaction(async (tx) => {
    assertTransition("policy", policy.status, "EXPIRED");
    const updated = await tx.policy.update({
      where: { id: policy.id },
      data: { status: "EXPIRED", version: { increment: 1 } },
    });
    await recordAudit(tx, {
      entityType: "Policy",
      entityId: policy.id,
      entityRef: policy.reference,
      action: "POLICY_EXPIRED",
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `Policy ${policy.reference} expired at end of term ${policy.effectiveTo.toISOString().slice(0, 10)}.`,
      payload: { expiredAt: at.toISOString() },
    });
    return updated;
  });
}

/** Renewal/endorsement guard: only live or expired policies can produce new business. */
export function assertPolicyPremiumMatches(policyPremium: string, quotePremium: string): void {
  if (!dec(policyPremium).eq(dec(quotePremium))) {
    throw new ConflictError("Stored policy premium does not match the quoted premium.");
  }
}
