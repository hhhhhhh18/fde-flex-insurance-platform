
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { assertAuthorized, type Role } from "@/lib/authz";
import { recordAudit } from "@/lib/audit/audit";
import { nextReference } from "@/lib/ids";
import { priceQuote } from "@/lib/pricing/engine";
import type { QuoteEvaluateInput } from "@/lib/validation/schemas";
import { addDays, loadPricingContext } from "./mappers";

export const quoteInclude = {
  applicant: true,
  product: { include: { coverageOptions: true } },
  asset: true,
  coverages: { include: { coverageOption: true } },
  riskFactors: { include: { riskFactor: true } },
  underwriting: { orderBy: { createdAt: "desc" } },
  policy: true,
} satisfies Prisma.QuoteInclude;

export type QuoteWithRelations = Prisma.QuoteGetPayload<{ include: typeof quoteInclude }>;

export interface Actor {
  role: Role;
  actorId: string;
}

/**
 * Evaluates a quote request through the single pricing engine, persists the
 * result with its full explanation and rule versions, opens an underwriting
 * referral when required, and records an audit event - all in one transaction.
 */
export async function evaluateQuote(raw: QuoteEvaluateInput, actor: Actor): Promise<QuoteWithRelations> {
  assertAuthorized(actor.role, "quote:evaluate");

  const asOf = raw.asOf ?? new Date().toISOString();
  const context = await loadPricingContext({
    applicantId: raw.applicantId,
    productId: raw.productId,
    assetId: raw.assetId ?? null,
    asOf,
  });
  context.input.requestedCoverages = raw.coverages;

  const result = priceQuote(context.input);

  return prisma.$transaction(
    async (tx) => {
      const reference = await nextReference(tx, "QTE", new Date(asOf));

      const quote = await tx.quote.create({
        data: {
          reference,
          applicantId: context.records.applicant.id,
          productId: context.records.product.id,
          assetId: context.records.asset?.id ?? null,
          status: "EVALUATED",
          decision: result.decision,
          decisionSummary: summarize(result.decision, result.reasons),
          referralReasons: result.referrals as unknown as Prisma.InputJsonValue,
          pricingBreakdown: {
            ...result.breakdown,
            inputSnapshot: result.inputSnapshot,
          } as unknown as Prisma.InputJsonValue,
          coverageLimit: result.totalCoverageLimit,
          netPremium: result.breakdown.netPremium,
          grossPremium: result.breakdown.grossPremium,
          factorProduct: result.breakdown.factorProduct,
          pricingVersion: result.breakdown.pricingVersion,
          rulesVersion: result.breakdown.rulesVersion,
          evaluatedAt: new Date(asOf),
          expiresAt: new Date(addDays(asOf, 30)),
          coverages: {
            create: result.coverages.map((line) => ({
              coverageOptionId: context.ids.coverageOptions[line.code]!,
              requestedLimit: line.requestedLimit,
              approvedLimit: line.approvedLimit,
              rateFactor: line.rateFactor,
              limitViolation: line.limitStatus !== "OK",
            })),
          },
          riskFactors: {
            create: result.breakdown.factors
              .filter((f) => context.ids.riskFactors[f.code])
              .map((f) => ({
                riskFactorId: context.ids.riskFactors[f.code]!,
                observedValue: f.observed,
                multiplier: f.multiplier,
                referred: f.triggersReferral,
              })),
          },
        },
        include: quoteInclude,
      });

      if (result.decision === "REFERRED") {
        await tx.underwritingDecision.create({
          data: {
            reference: await nextReference(tx, "UWD", new Date(asOf)),
            quoteId: quote.id,
            status: "PENDING",
            triggerCodes: result.referrals.map((r) => r.code) as unknown as Prisma.InputJsonValue,
            summary: result.referrals.map((r) => r.message).join(" "),
          },
        });
      }

      await recordAudit(tx, {
        entityType: "Quote",
        entityId: quote.id,
        entityRef: quote.reference,
        action: "QUOTE_EVALUATED",
        actorRole: actor.role,
        actorId: actor.actorId,
        summary: `Quote ${quote.reference} evaluated: ${result.decision} at ${result.breakdown.grossPremium}.`,
        payload: {
          decision: result.decision,
          grossPremium: result.breakdown.grossPremium,
          factorProduct: result.breakdown.factorProduct,
          referrals: result.referrals.map((r) => r.code),
          pricingVersion: result.breakdown.pricingVersion,
          rulesVersion: result.breakdown.rulesVersion,
        },
      });

      return tx.quote.findUniqueOrThrow({ where: { id: quote.id }, include: quoteInclude });
    },
    { maxWait: 10000, timeout: 30000 },
  );
}

function summarize(decision: string, reasons: { message: string }[]): string {
  if (decision === "ELIGIBLE") return "Eligible for automatic acceptance.";
  const top = reasons.filter((r) => !r.message.startsWith("Rating factor")).slice(0, 3);
  return top.map((r) => r.message).join(" ") || decision;
}

export interface QuoteFilters {
  page: number;
  pageSize: number;
  q?: string;
  decision?: string;
  status?: string;
}

export async function listQuotes(filters: QuoteFilters) {
  const where: Prisma.QuoteWhereInput = {};
  if (filters.decision) where.decision = filters.decision as never;
  if (filters.status) where.status = filters.status as never;
  if (filters.q) {
    where.OR = [
      { reference: { contains: filters.q, mode: "insensitive" } },
      { applicant: { firstName: { contains: filters.q, mode: "insensitive" } } },
      { applicant: { lastName: { contains: filters.q, mode: "insensitive" } } },
      { product: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  const [items, total] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        applicant: { select: { firstName: true, lastName: true, reference: true } },
        product: { select: { name: true, code: true, category: true } },
        asset: { select: { reference: true, assetType: true } },
      },
      orderBy: { evaluatedAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.quote.count({ where }),
  ]);
  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getQuote(idOrRef: string): Promise<QuoteWithRelations | null> {
  return prisma.quote.findFirst({
    where: { OR: [{ id: idOrRef }, { reference: idOrRef }] },
    include: quoteInclude,
  });
}
