import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAuthorized } from "@/lib/authz";
import { recordAudit } from "@/lib/audit/audit";
import { ConflictError, InputError, NotFoundError } from "@/lib/errors";
import { assertTransition } from "@/lib/lifecycle/state-machine";
import { nextReference } from "@/lib/ids";
import { priceQuote } from "@/lib/pricing/engine";
import type { PricingInput } from "@/lib/pricing/types";
import type { RenewalGenerateInput } from "@/lib/validation/schemas";
import { addDays, addMonths, dateOnly } from "./mappers";
import type { Actor } from "./quote-service";

export const renewalInclude = {
  policy: { include: { applicant: true, product: true, asset: true } },
  resultingPolicy: true,
} satisfies Prisma.RenewalInclude;

/**
 * Creates a renewal offer for an ACTIVE or EXPIRED policy. Cancelled policies are
 * never renewable. The offer is re-rated through the same pricing engine using the
 * original quote's input snapshot so the explanation stays reproducible.
 */
export async function generateRenewal(raw: RenewalGenerateInput, actor: Actor, at: Date = new Date()) {
  assertAuthorized(actor.role, "renewal:generate");

  const policy = await prisma.policy.findUnique({
    where: { id: raw.policyId },
    include: { quote: true, renewals: true },
  });
  if (!policy) throw new NotFoundError("Policy", raw.policyId);

  if (policy.status === "CANCELLED") {
    throw new ConflictError(`Policy ${policy.reference} was cancelled and cannot be renewed.`);
  }
  if (policy.status !== "ACTIVE" && policy.status !== "EXPIRED") {
    throw new ConflictError(`Policy ${policy.reference} is ${policy.status}; only ACTIVE or EXPIRED policies can be renewed.`);
  }
  if (policy.renewals.some((r) => r.status === "OFFERED")) {
    throw new ConflictError(`Policy ${policy.reference} already has an open renewal offer.`);
  }
  if (policy.renewals.some((r) => r.status === "ACCEPTED")) {
    throw new ConflictError(`Policy ${policy.reference} has already been renewed.`);
  }

  const start = addDays(policy.effectiveTo.toISOString().slice(0, 10), 1);
  const end = addMonths(start, raw.termMonths);

  const snapshot = (policy.quote.pricingBreakdown as unknown as { inputSnapshot: PricingInput }).inputSnapshot;
  if (!snapshot) throw new ConflictError("Policy quote has no pricing snapshot; cannot re-rate the renewal.");

  const repriced = priceQuote({ ...structuredClone(snapshot), asOf: `${start}T00:00:00.000Z` });
  if (repriced.decision === "INELIGIBLE") {
    throw new InputError(
      `Renewal cannot be offered: ${repriced.reasons.map((r) => r.message).join(" ")}`,
      repriced.reasons,
    );
  }

  const offerExpiresAt = addDays(at.toISOString().slice(0, 10), raw.offerValidDays);

  return prisma.$transaction(async (tx) => {
    const renewal = await tx.renewal.create({
      data: {
        reference: await nextReference(tx, "RNW"),
        policyId: policy.id,
        status: "OFFERED",
        offeredPremium: repriced.breakdown.grossPremium,
        effectiveFrom: dateOnly(start),
        effectiveTo: dateOnly(end),
        offerExpiresAt: dateOnly(offerExpiresAt),
      },
    });

    await recordAudit(tx, {
      entityType: "Renewal",
      entityId: renewal.id,
      entityRef: renewal.reference,
      action: "RENEWAL_OFFERED",
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `Renewal ${renewal.reference} offered for policy ${policy.reference} at ${repriced.breakdown.grossPremium} (${start}..${end}).`,
      payload: {
        policyReference: policy.reference,
        offeredPremium: repriced.breakdown.grossPremium,
        decision: repriced.decision,
        effectiveFrom: start,
        effectiveTo: end,
      },
    });

    return tx.renewal.findUniqueOrThrow({ where: { id: renewal.id }, include: renewalInclude });
  });
}

/** Accepts or declines an open renewal offer. Acceptance creates the successor policy. */
export async function respondToRenewal(
  input: { renewalId: string; action: "ACCEPT" | "DECLINE"; reason?: string },
  actor: Actor,
  at: Date = new Date(),
) {
  assertAuthorized(actor.role, "renewal:respond");

  const renewal = await prisma.renewal.findUnique({
    where: { id: input.renewalId },
    include: {
      policy: { include: { quote: { include: { coverages: true, riskFactors: true } } } },
      resultingPolicy: true,
    },
  });
  if (!renewal) throw new NotFoundError("Renewal", input.renewalId);
  if (renewal.status !== "OFFERED") throw new ConflictError(`Renewal ${renewal.reference} is already ${renewal.status}.`);
  if (renewal.resultingPolicyId) throw new ConflictError(`Renewal ${renewal.reference} already produced a policy.`);
  if (renewal.offerExpiresAt < new Date(`${at.toISOString().slice(0, 10)}T00:00:00.000Z`)) {
    await prisma.$transaction(async (tx) => {
      assertTransition("renewal", renewal.status, "EXPIRED");
      await tx.renewal.update({ where: { id: renewal.id }, data: { status: "EXPIRED" } });
      await recordAudit(tx, {
        entityType: "Renewal",
        entityId: renewal.id,
        entityRef: renewal.reference,
        action: "RENEWAL_EXPIRED",
        actorRole: actor.role,
        actorId: actor.actorId,
        summary: `Renewal ${renewal.reference} expired before a response was recorded.`,
      });
    });
    throw new ConflictError(`Renewal offer ${renewal.reference} expired on ${renewal.offerExpiresAt.toISOString().slice(0, 10)}.`);
  }

  if (input.action === "DECLINE") {
    if (!input.reason) throw new InputError("A decline reason is required.");
    return prisma.$transaction(async (tx) => {
      assertTransition("renewal", "OFFERED", "DECLINED");
      const declined = await tx.renewal.update({
        where: { id: renewal.id },
        data: { status: "DECLINED", declinedAt: at, declineReason: input.reason },
      });
      await recordAudit(tx, {
        entityType: "Renewal",
        entityId: renewal.id,
        entityRef: renewal.reference,
        action: "RENEWAL_DECLINED",
        actorRole: actor.role,
        actorId: actor.actorId,
        summary: `Renewal ${renewal.reference} declined: ${input.reason}`,
      });
      return declined;
    });
  }

  return prisma.$transaction(async (tx) => {
    assertTransition("renewal", "OFFERED", "ACCEPTED");

    const conflicting = await tx.policy.findFirst({
      where: {
        assetId: renewal.policy.assetId,
        id: { not: renewal.policyId },
        status: { in: ["ACTIVE", "PENDING_PAYMENT"] },
        effectiveFrom: { lte: renewal.effectiveTo },
        effectiveTo: { gte: renewal.effectiveFrom },
      },
    });
    if (conflicting) {
      throw new ConflictError(
        `Renewal period overlaps existing policy ${conflicting.reference}; resolve the coverage conflict first.`,
      );
    }

    // Re-price at the renewal start date so the successor quote carries its own
    // reproducible snapshot (validators recompute from that snapshot).
    const renewalSnapshot = (renewal.policy.quote.pricingBreakdown as unknown as { inputSnapshot: PricingInput })
      .inputSnapshot;
    const renewalStart = renewal.effectiveFrom.toISOString().slice(0, 10);
    const repricedSnapshot = priceQuote({ ...structuredClone(renewalSnapshot), asOf: `${renewalStart}T00:00:00.000Z` });

    // A renewal gets its own quote record so the one-policy-per-quote invariant
    // (enforced by the unique index on Policy.quoteId) stays intact and the
    // renewal carries its own immutable pricing trail.
    const renewalQuote = await tx.quote.create({
      data: {
        reference: await nextReference(tx, "QTE"),
        applicantId: renewal.policy.applicantId,
        productId: renewal.policy.productId,
        assetId: renewal.policy.assetId,
        status: "ACCEPTED",
        decision: "ELIGIBLE",
        decisionSummary: `Renewal of ${renewal.policy.reference} accepted at the offered premium.`,
        referralReasons: [],
        pricingBreakdown: {
          ...repricedSnapshot.breakdown,
          inputSnapshot: repricedSnapshot.inputSnapshot,
        } as unknown as Prisma.InputJsonValue,
        coverageLimit: renewal.policy.coverageLimit,
        netPremium: renewal.offeredPremium,
        grossPremium: renewal.offeredPremium,
        factorProduct: repricedSnapshot.breakdown.factorProduct,
        pricingVersion: repricedSnapshot.breakdown.pricingVersion,
        rulesVersion: repricedSnapshot.breakdown.rulesVersion,
        evaluatedAt: at,
        expiresAt: renewal.offerExpiresAt,
        coverages: {
          create: renewal.policy.quote.coverages.map((c) => ({
            coverageOptionId: c.coverageOptionId,
            requestedLimit: c.requestedLimit,
            approvedLimit: c.approvedLimit,
            rateFactor: c.rateFactor,
            limitViolation: c.limitViolation,
          })),
        },
        riskFactors: {
          create: renewal.policy.quote.riskFactors.map((r) => ({
            riskFactorId: r.riskFactorId,
            observedValue: r.observedValue,
            multiplier: r.multiplier,
            referred: r.referred,
          })),
        },
      },
    });

    const policy = await tx.policy.create({
      data: {
        reference: await nextReference(tx, "POL"),
        quoteId: renewalQuote.id,
        applicantId: renewal.policy.applicantId,
        productId: renewal.policy.productId,
        assetId: renewal.policy.assetId,
        status: "PENDING_PAYMENT",
        paymentStatus: "UNPAID",
        effectiveFrom: renewal.effectiveFrom,
        effectiveTo: renewal.effectiveTo,
        premium: renewal.offeredPremium,
        coverageLimit: renewal.policy.coverageLimit,
        issuedByRole: actor.role,
        issuedBy: actor.actorId,
      },
    });

    // The predecessor keeps ACTIVE status until its own expiry date so mid-term
    // coverage is not truncated by an early renewal acceptance.
    if (renewal.policy.effectiveTo < new Date(`${at.toISOString().slice(0, 10)}T00:00:00.000Z`)) {
      await tx.policy.update({
        where: { id: renewal.policyId },
        data: { status: "EXPIRED", version: { increment: 1 } },
      });
    }

    const accepted = await tx.renewal.update({
      where: { id: renewal.id },
      data: { status: "ACCEPTED", acceptedAt: at, resultingPolicyId: policy.id },
    });

    await recordAudit(tx, {
      entityType: "Renewal",
      entityId: renewal.id,
      entityRef: renewal.reference,
      action: "RENEWAL_ACCEPTED",
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `Renewal ${renewal.reference} accepted; successor policy ${policy.reference} created in PENDING_PAYMENT.`,
      payload: { resultingPolicy: policy.reference, premium: renewal.offeredPremium.toString() },
    });

    await recordAudit(tx, {
      entityType: "Policy",
      entityId: policy.id,
      entityRef: policy.reference,
      action: "POLICY_CREATED",
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `Policy ${policy.reference} created from renewal ${renewal.reference}.`,
      payload: { renewalReference: renewal.reference },
    });

    return accepted;
  });
}

export async function listRenewals(filters: { page: number; pageSize: number; status?: string }) {
  const where: Prisma.RenewalWhereInput = filters.status ? { status: filters.status as never } : {};
  const [items, total] = await Promise.all([
    prisma.renewal.findMany({
      where,
      include: { policy: { include: { applicant: true, product: true } }, resultingPolicy: true },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.renewal.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getRenewal(idOrRef: string) {
  return prisma.renewal.findFirst({
    where: { OR: [{ id: idOrRef }, { reference: idOrRef }] },
    include: renewalInclude,
  });
}
