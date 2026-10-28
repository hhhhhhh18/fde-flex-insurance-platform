import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { dec, money, round2 } from "@/lib/money";
import { nextReference } from "@/lib/ids";
import { addDays, addMonths, dateOnly } from "@/services/mappers";
import type { SeededRng } from "./rng";

export interface AnomalyOptions {
  rng: SeededRng;
  datasetLabel: string;
  anchor: Date;
}

interface LabelRow {
  anomalyCode: string;
  entityType: string;
  entityRef: string;
  expectedIssue: string;
  expectedDecision?: string;
  description: string;
}

/**
 * Creates a small, labelled set of deliberate defects. Every record produced here
 * is registered in AnomalyLabel; nothing else in the dataset is corrupted.
 *
 * Anomaly codes and the issue codes they should trigger:
 *   ANOM_PREMIUM_MISMATCH        -> PRM_FORMULA_MISMATCH
 *   ANOM_UNAUTHORIZED_ISSUANCE   -> LIFECYCLE_INVALID
 *   ANOM_COVERAGE_LIMIT          -> COV_LIMIT_EXCEEDED
 *   ANOM_INVALID_RENEWAL         -> RNW_INVALID_RELATIONSHIP
 *   ANOM_OVERLAPPING_POLICY      -> POL_OVERLAP
 *   ANOM_RISK_INFO_IGNORED       -> DQ_RISK_INFO_MISSING
 *   ANOM_DATE_INVERSION          -> DATE_ORDER_INVALID
 */
export async function seedAnomalies({ rng, datasetLabel, anchor }: AnomalyOptions): Promise<number> {
  const labels: LabelRow[] = [];
  const anchorIso = anchor.toISOString().slice(0, 10);

  // 1. Premium that no longer matches the pricing formula.
  const pricedQuote = await prisma.quote.findFirst({
    where: { decision: "ELIGIBLE", policy: { isNot: null } },
    include: { policy: true },
    orderBy: { reference: "asc" },
    skip: rng.int(0, 2),
  });
  if (pricedQuote?.policy) {
    const inflated = round2(dec(pricedQuote.grossPremium).times("1.05")).toFixed(2);
    await prisma.$transaction([
      prisma.quote.update({
        where: { id: pricedQuote.id },
        data: { grossPremium: inflated, netPremium: inflated },
      }),
      prisma.policy.update({ where: { id: pricedQuote.policy.id }, data: { premium: inflated } }),
    ]);
    labels.push({
      anomalyCode: "ANOM_PREMIUM_MISMATCH",
      entityType: "Quote",
      entityRef: pricedQuote.reference,
      expectedIssue: "PRM_FORMULA_MISMATCH",
      expectedDecision: "ELIGIBLE",
      description: `Gross premium inflated by 5% to ${inflated} without re-running the pricing engine.`,
    });
  }

  // 2. Policy bound from a referred quote with no underwriting approval and no payment.
  const referred = await prisma.quote.findFirst({
    where: { decision: "REFERRED", policy: null, underwriting: { some: { status: "PENDING" } } },
    orderBy: { reference: "asc" },
  });
  if (referred) {
    const policy = await prisma.$transaction(async (tx) => {
      const reference = await nextReference(tx, "POL", anchor);
      return tx.policy.create({
        data: {
          reference,
          quoteId: referred.id,
          applicantId: referred.applicantId,
          productId: referred.productId,
          assetId: referred.assetId,
          status: "ACTIVE",
          paymentStatus: "UNPAID",
          effectiveFrom: dateOnly(anchorIso),
          effectiveTo: dateOnly(addMonths(anchorIso, 12)),
          premium: referred.grossPremium,
          coverageLimit: referred.coverageLimit,
          issuedByRole: "APPLICANT",
          issuedBy: "applicant-demo",
        },
      });
    });
    labels.push({
      anomalyCode: "ANOM_UNAUTHORIZED_ISSUANCE",
      entityType: "Policy",
      entityRef: policy.reference,
      expectedIssue: "LIFECYCLE_INVALID",
      expectedDecision: "REFERRED",
      description: "Policy activated from a referred quote by the APPLICANT role with unpaid premium and no reviewer approval.",
    });
  }

  // 3. Coverage line above its configured maximum, not flagged.
  const coverageOwner = await prisma.quote.findFirst({
    where: { coverages: { some: {} } },
    include: { coverages: { include: { coverageOption: true } } },
    orderBy: { reference: "desc" },
  });
  const targetCoverage = coverageOwner?.coverages[0];
  if (coverageOwner && targetCoverage) {
    const inflated = round2(dec(targetCoverage.coverageOption.maxLimit).times("1.25")).toFixed(2);
    await prisma.quoteCoverage.update({
      where: { id: targetCoverage.id },
      data: { requestedLimit: inflated, approvedLimit: inflated, limitViolation: false },
    });
    labels.push({
      anomalyCode: "ANOM_COVERAGE_LIMIT",
      entityType: "Quote",
      entityRef: coverageOwner.reference,
      expectedIssue: "COV_LIMIT_EXCEEDED",
      description: `Coverage ${targetCoverage.coverageOption.code} raised to ${inflated}, above its maximum of ${targetCoverage.coverageOption.maxLimit.toString()}.`,
    });
  }

  // 4. Renewal offered on a cancelled policy.
  const cancelled = await prisma.policy.findFirst({
    where: { status: "CANCELLED" },
    orderBy: { reference: "asc" },
  });
  if (cancelled) {
    const renewal = await prisma.$transaction(async (tx) => {
      const reference = await nextReference(tx, "RNW", anchor);
      return tx.renewal.create({
        data: {
          reference,
          policyId: cancelled.id,
          status: "OFFERED",
          offeredPremium: cancelled.premium,
          effectiveFrom: dateOnly(addDays(cancelled.effectiveTo.toISOString().slice(0, 10), 1)),
          effectiveTo: dateOnly(addMonths(addDays(cancelled.effectiveTo.toISOString().slice(0, 10), 1), 12)),
          offerExpiresAt: dateOnly(addDays(anchorIso, 30)),
        },
      });
    });
    labels.push({
      anomalyCode: "ANOM_INVALID_RENEWAL",
      entityType: "Renewal",
      entityRef: renewal.reference,
      expectedIssue: "RNW_INVALID_RELATIONSHIP",
      description: `Renewal offered for cancelled policy ${cancelled.reference}.`,
    });
  }

  // 5. Overlapping live coverage for the same asset.
  const overlappingSource = await prisma.policy.findFirst({
    where: { status: "ACTIVE", assetId: { not: null } },
    include: { quote: { include: { coverages: true, riskFactors: true } } },
    orderBy: { reference: "asc" },
  });
  if (overlappingSource?.assetId) {
    const start = addDays(overlappingSource.effectiveFrom.toISOString().slice(0, 10), 20);
    const end = addDays(start, 120);
    // The source column may already be inflated by the premium anomaly; the copied
    // breakdown carries the original priced value, so keep them consistent.
    const sourceSnapshotPremium =
      (overlappingSource.quote.pricingBreakdown as { grossPremium?: string }).grossPremium ??
      overlappingSource.quote.grossPremium.toString();

    const duplicate = await prisma.$transaction(async (tx) => {
      const quoteReference = await nextReference(tx, "QTE", anchor);
      const quote = await tx.quote.create({
        data: {
          reference: quoteReference,
          applicantId: overlappingSource.applicantId,
          productId: overlappingSource.productId,
          assetId: overlappingSource.assetId,
          status: "ACCEPTED",
          decision: "ELIGIBLE",
          decisionSummary: "Duplicate cover arranged for the same asset (injected anomaly).",
          referralReasons: [],
          pricingBreakdown: overlappingSource.quote.pricingBreakdown as Prisma.InputJsonValue,
          coverageLimit: overlappingSource.coverageLimit,
          // Use the source QUOTE premium (not the policy premium, which may include
          // applied endorsement deltas) so the copied breakdown stays self-consistent.
          netPremium: sourceSnapshotPremium,
          grossPremium: sourceSnapshotPremium,
          factorProduct: overlappingSource.quote.factorProduct,
          pricingVersion: overlappingSource.quote.pricingVersion,
          rulesVersion: overlappingSource.quote.rulesVersion,
          evaluatedAt: anchor,
          expiresAt: dateOnly(addDays(anchorIso, 30)),
          coverages: {
            create: overlappingSource.quote.coverages.map((c) => ({
              coverageOptionId: c.coverageOptionId,
              requestedLimit: c.requestedLimit,
              approvedLimit: c.approvedLimit,
              rateFactor: c.rateFactor,
            })),
          },
          riskFactors: {
            create: overlappingSource.quote.riskFactors.map((r) => ({
              riskFactorId: r.riskFactorId,
              observedValue: r.observedValue,
              multiplier: r.multiplier,
              referred: r.referred,
            })),
          },
        },
      });
      const policyReference = await nextReference(tx, "POL", anchor);
      return tx.policy.create({
        data: {
          reference: policyReference,
          quoteId: quote.id,
          applicantId: overlappingSource.applicantId,
          productId: overlappingSource.productId,
          assetId: overlappingSource.assetId,
          status: "ACTIVE",
          paymentStatus: "PAID",
          effectiveFrom: dateOnly(start),
          effectiveTo: dateOnly(end),
          premium: sourceSnapshotPremium,
          coverageLimit: overlappingSource.coverageLimit,
          issuedByRole: "OPERATIONS_ANALYST",
          issuedBy: "analyst-demo",
        },
      });
    });
    labels.push({
      anomalyCode: "ANOM_OVERLAPPING_POLICY",
      entityType: "Policy",
      entityRef: duplicate.reference,
      expectedIssue: "POL_OVERLAP",
      description: `Policy overlaps live coverage ${overlappingSource.reference} for asset ${overlappingSource.assetId} (${start}..${end}).`,
    });
  }

  // 6. Asset risk data removed after an eligible quote was bound.
  const vulnerableAsset = await prisma.insuredAsset.findFirst({
    where: { riskDataComplete: true, policies: { some: { status: "ACTIVE" } } },
    orderBy: { reference: "desc" },
  });
  if (vulnerableAsset) {
    await prisma.insuredAsset.update({
      where: { id: vulnerableAsset.id },
      data: { riskDataComplete: false, missingRiskField: "roof_condition" },
    });
    labels.push({
      anomalyCode: "ANOM_RISK_INFO_IGNORED",
      entityType: "InsuredAsset",
      entityRef: vulnerableAsset.reference,
      expectedIssue: "DQ_RISK_INFO_MISSING",
      description: "Risk questionnaire flagged incomplete while an ACTIVE policy remains in force without a data-quality decision.",
    });
  }

  // 7. Policy whose end date precedes its start date.
  const inverted = await prisma.policy.findFirst({
    where: { status: "EXPIRED", renewals: { none: {} }, endorsements: { none: {} } },
    orderBy: { reference: "desc" },
  });
  if (inverted) {
    await prisma.policy.update({
      where: { id: inverted.id },
      data: { effectiveTo: dateOnly(addDays(inverted.effectiveFrom.toISOString().slice(0, 10), -30)) },
    });
    labels.push({
      anomalyCode: "ANOM_DATE_INVERSION",
      entityType: "Policy",
      entityRef: inverted.reference,
      expectedIssue: "DATE_ORDER_INVALID",
      description: "Policy effectiveTo set 30 days before effectiveFrom.",
    });
  }

  if (labels.length > 0) {
    await prisma.anomalyLabel.createMany({
      data: labels.map((label) => ({
        datasetLabel,
        anomalyCode: label.anomalyCode,
        entityType: label.entityType,
        entityRef: label.entityRef,
        expectedIssue: label.expectedIssue,
        expectedDecision: label.expectedDecision ?? null,
        description: label.description,
      })),
      skipDuplicates: true,
    });
  }

  return labels.length;
}

/** Helper used by the reporting layer only - never by the detector. */
export async function listLabels(datasetLabel?: string) {
  return prisma.anomalyLabel.findMany({
    where: datasetLabel ? { datasetLabel } : undefined,
    orderBy: [{ anomalyCode: "asc" }, { entityRef: "asc" }],
  });
}

export { money };
