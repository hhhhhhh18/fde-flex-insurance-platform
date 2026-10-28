import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAuthorized, authorityLimit, checkAuthority } from "@/lib/authz";
import { recordAudit } from "@/lib/audit/audit";
import { ConflictError, ForbiddenError, NotFoundError } from "@/lib/errors";
import { money } from "@/lib/money";
import { assertTransition } from "@/lib/lifecycle/state-machine";
import { nextReference } from "@/lib/ids";
import type { UnderwritingInput } from "@/lib/validation/schemas";
import type { Actor } from "./quote-service";

export const underwritingInclude = {
  quote: {
    include: {
      applicant: true,
      product: true,
      asset: true,
      coverages: { include: { coverageOption: true } },
      riskFactors: { include: { riskFactor: true } },
    },
  },
} satisfies Prisma.UnderwritingDecisionInclude;

/** Work queue: open referrals, oldest first, with everything a reviewer needs. */
export async function getUnderwritingQueue() {
  const [pending, recent] = await Promise.all([
    prisma.underwritingDecision.findMany({
      where: { status: { in: ["PENDING", "INFORMATION_REQUESTED"] } },
      include: underwritingInclude,
      orderBy: { createdAt: "asc" },
      take: 100,
    }),
    prisma.underwritingDecision.findMany({
      where: { status: { in: ["APPROVED", "DECLINED"] } },
      include: underwritingInclude,
      orderBy: { decidedAt: "desc" },
      take: 25,
    }),
  ]);
  return { pending, recent };
}

export async function decideUnderwriting(raw: UnderwritingInput, actor: Actor) {
  assertAuthorized(actor.role, "underwriting:decide");

  const decision = await prisma.underwritingDecision.findFirst({
    where: raw.decisionId ? { id: raw.decisionId } : { quoteId: raw.quoteId, status: { in: ["PENDING", "INFORMATION_REQUESTED"] } },
    include: { quote: true },
    orderBy: { createdAt: "desc" },
  });
  if (!decision) throw new NotFoundError("UnderwritingDecision", raw.decisionId ?? raw.quoteId ?? "");

  if (raw.outcome === "INFORMATION_REQUESTED" && decision.status === "INFORMATION_REQUESTED") {
    throw new ConflictError("This case is already awaiting additional information.");
  }
  assertTransition("underwriting", decision.status, raw.outcome);

  const authority = checkAuthority(actor.role, decision.quote.grossPremium);
  if (!authority.allowed) throw new ForbiddenError(authority.reason ?? "Insufficient authority for this referral.");

  return prisma.$transaction(async (tx) => {
    const updated = await tx.underwritingDecision.update({
      where: { id: decision.id },
      data: {
        status: raw.outcome,
        reviewer: actor.actorId,
        reviewerRole: actor.role,
        authorityLimit: money(authorityLimit(actor.role)),
        notes: raw.notes,
        requestedInfo: raw.requestedInfo ?? null,
        decidedAt: new Date(),
      },
    });

    const quoteDecision =
      raw.outcome === "APPROVED" ? "ELIGIBLE" : raw.outcome === "DECLINED" ? "INELIGIBLE" : "AWAITING_INFORMATION";

    await tx.quote.update({
      where: { id: decision.quoteId },
      data: { decision: quoteDecision, decisionSummary: `Underwriting ${raw.outcome.toLowerCase()}: ${raw.notes}` },
    });

    await recordAudit(tx, {
      entityType: "UnderwritingDecision",
      entityId: decision.id,
      entityRef: decision.reference,
      action: `UNDERWRITING_${raw.outcome}`,
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `Referral ${decision.reference} ${raw.outcome.toLowerCase()} by ${actor.role}.`,
      payload: {
        quoteId: decision.quoteId,
        quoteReference: decision.quote.reference,
        premium: decision.quote.grossPremium.toString(),
        authorityLimit: money(authorityLimit(actor.role)),
        notes: raw.notes,
      },
    });

    await recordAudit(tx, {
      entityType: "Quote",
      entityId: decision.quoteId,
      entityRef: decision.quote.reference,
      action: "QUOTE_DECISION_UPDATED",
      actorRole: actor.role,
      actorId: actor.actorId,
      summary: `Quote ${decision.quote.reference} decision changed to ${quoteDecision} after underwriting.`,
      payload: { underwritingReference: decision.reference, outcome: raw.outcome },
    });

    return updated;
  });
}

/** Creates a referral for a quote that has none (used by seeded referral scenarios). */
export async function openReferral(tx: Prisma.TransactionClient, quoteId: string, codes: string[], summary: string) {
  return tx.underwritingDecision.create({
    data: {
      reference: await nextReference(tx, "UWD"),
      quoteId,
      status: "PENDING",
      triggerCodes: codes,
      summary,
    },
  });
}
