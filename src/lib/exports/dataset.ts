import { createHash } from "node:crypto";
import { prisma } from "@/lib/db";

export type Row = Record<string, unknown>;
export type Dataset = Record<string, Row[]>;

const date = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : null);
const amount = (value: { toString(): string } | null | undefined) => (value ? value.toString() : null);

/**
 * Deterministic dataset projection used for exports and checksums.
 *
 * Rules that make regeneration comparable:
 *  - business references only (no cuid/auto-increment ids)
 *  - every entity ordered by its natural key
 *  - dates normalised to YYYY-MM-DD, amounts to NUMERIC strings
 *  - volatile columns (createdAt/updatedAt/issuedAt) excluded
 */
export const DATASET_ENTITIES = [
  "products",
  "coverageOptions",
  "riskFactors",
  "applicants",
  "assets",
  "quotes",
  "policies",
  "endorsements",
  "renewals",
  "underwriting",
] as const;

export type DatasetEntity = (typeof DATASET_ENTITIES)[number];

export async function buildDataset(): Promise<Dataset> {
  const [products, coverageOptions, riskFactors, applicants, assets, quotes, policies, endorsements, renewals, uw] =
    await Promise.all([
      prisma.product.findMany({ orderBy: { code: "asc" } }),
      prisma.coverageOption.findMany({ include: { product: true }, orderBy: [{ productId: "asc" }, { code: "asc" }] }),
      prisma.riskFactor.findMany({ include: { product: true }, orderBy: { code: "asc" } }),
      prisma.applicant.findMany({ orderBy: { reference: "asc" } }),
      prisma.insuredAsset.findMany({ include: { applicant: true }, orderBy: { reference: "asc" } }),
      prisma.quote.findMany({
        include: {
          applicant: true,
          product: true,
          asset: true,
          coverages: { include: { coverageOption: true } },
          riskFactors: { include: { riskFactor: true } },
        },
        orderBy: { reference: "asc" },
      }),
      prisma.policy.findMany({
        include: { quote: true, applicant: true, product: true, asset: true },
        orderBy: { reference: "asc" },
      }),
      prisma.endorsement.findMany({ include: { policy: true }, orderBy: { reference: "asc" } }),
      prisma.renewal.findMany({ include: { policy: true, resultingPolicy: true }, orderBy: { reference: "asc" } }),
      prisma.underwritingDecision.findMany({ include: { quote: true }, orderBy: { reference: "asc" } }),
    ]);

  return {
    products: products.map((p) => ({
      code: p.code,
      name: p.name,
      category: p.category,
      status: p.status,
      description: p.description,
      baseRate: amount(p.baseRate),
      minimumPremium: amount(p.minimumPremium),
      maxCoverageLimit: amount(p.maxCoverageLimit),
      referralThreshold: amount(p.referralThreshold),
      autoBindLimit: amount(p.autoBindLimit),
      minAssetValue: amount(p.minAssetValue),
      maxAssetValue: amount(p.maxAssetValue),
      minApplicantAge: p.minApplicantAge,
      maxApplicantAge: p.maxApplicantAge,
      effectiveFrom: date(p.effectiveFrom),
      effectiveTo: date(p.effectiveTo),
      pricingVersion: p.pricingVersion,
      rulesVersion: p.rulesVersion,
    })),
    coverageOptions: coverageOptions.map((c) => ({
      productCode: c.product.code,
      code: c.code,
      name: c.name,
      coverageType: c.coverageType,
      rateFactor: amount(c.rateFactor),
      minLimit: amount(c.minLimit),
      maxLimit: amount(c.maxLimit),
      defaultLimit: amount(c.defaultLimit),
      required: c.required,
      active: c.active,
    })),
    riskFactors: riskFactors.map((f) => ({
      code: f.code,
      label: f.label,
      productCode: f.product?.code ?? null,
      metric: f.metric,
      operator: f.operator,
      thresholdValue: amount(f.thresholdValue),
      thresholdText: f.thresholdText,
      multiplier: amount(f.multiplier),
      triggersReferral: f.triggersReferral,
      explanation: f.explanation,
      active: f.active,
    })),
    applicants: applicants.map((a) => ({
      reference: a.reference,
      firstName: a.firstName,
      lastName: a.lastName,
      email: a.email,
      phone: a.phone,
      dateOfBirth: date(a.dateOfBirth),
      country: a.country,
      region: a.region,
      occupation: a.occupation,
      occupationClass: a.occupationClass,
      annualIncome: amount(a.annualIncome),
      creditBand: a.creditBand,
    })),
    assets: assets.map((a) => ({
      reference: a.reference,
      applicantRef: a.applicant.reference,
      assetType: a.assetType,
      description: a.description,
      yearBuilt: a.yearBuilt,
      purchaseValue: amount(a.purchaseValue),
      currentValue: amount(a.currentValue),
      condition: a.condition,
      usage: a.usage,
      claimsHistory5y: a.claimsHistory5y,
      region: a.region,
      riskDataComplete: a.riskDataComplete,
      missingRiskField: a.missingRiskField,
    })),
    quotes: quotes.map((q) => ({
      reference: q.reference,
      applicantRef: q.applicant.reference,
      productCode: q.product.code,
      assetRef: q.asset?.reference ?? null,
      status: q.status,
      decision: q.decision,
      coverageLimit: amount(q.coverageLimit),
      netPremium: amount(q.netPremium),
      grossPremium: amount(q.grossPremium),
      factorProduct: amount(q.factorProduct),
      pricingVersion: q.pricingVersion,
      rulesVersion: q.rulesVersion,
      evaluatedAt: date(q.evaluatedAt),
      expiresAt: date(q.expiresAt),
      coverages: [...q.coverages]
        .sort((a, b) => a.coverageOption.code.localeCompare(b.coverageOption.code))
        .map((c) => ({
          code: c.coverageOption.code,
          requestedLimit: amount(c.requestedLimit),
          approvedLimit: amount(c.approvedLimit),
          rateFactor: amount(c.rateFactor),
          limitViolation: c.limitViolation,
        })),
      appliedFactors: [...q.riskFactors]
        .sort((a, b) => a.riskFactor.code.localeCompare(b.riskFactor.code))
        .map((r) => ({
          code: r.riskFactor.code,
          observedValue: r.observedValue,
          multiplier: amount(r.multiplier),
          referred: r.referred,
        })),
    })),
    policies: policies.map((p) => ({
      reference: p.reference,
      quoteRef: p.quote.reference,
      applicantRef: p.applicant.reference,
      productCode: p.product.code,
      assetRef: p.asset?.reference ?? null,
      status: p.status,
      paymentStatus: p.paymentStatus,
      effectiveFrom: date(p.effectiveFrom),
      effectiveTo: date(p.effectiveTo),
      premium: amount(p.premium),
      coverageLimit: amount(p.coverageLimit),
      issuedByRole: p.issuedByRole,
      cancellationReason: p.cancellationReason,
    })),
    endorsements: endorsements.map((e) => ({
      reference: e.reference,
      policyRef: e.policy.reference,
      type: e.type,
      status: e.status,
      effectiveDate: date(e.effectiveDate),
      reason: e.reason,
      premiumDelta: amount(e.premiumDelta),
      approvedByRole: e.approvedByRole,
      rejectionReason: e.rejectionReason,
    })),
    renewals: renewals.map((r) => ({
      reference: r.reference,
      policyRef: r.policy.reference,
      status: r.status,
      offeredPremium: amount(r.offeredPremium),
      effectiveFrom: date(r.effectiveFrom),
      effectiveTo: date(r.effectiveTo),
      offerExpiresAt: date(r.offerExpiresAt),
      resultingPolicyRef: r.resultingPolicy?.reference ?? null,
      declineReason: r.declineReason,
    })),
    underwriting: uw.map((u) => ({
      reference: u.reference,
      quoteRef: u.quote.reference,
      status: u.status,
      triggerCodes: u.triggerCodes,
      summary: u.summary,
      reviewerRole: u.reviewerRole,
      decidedAt: date(u.decidedAt),
    })),
  };
}

/** Stable JSON: object keys sorted recursively, arrays preserved in order. */
export function canonicalJson(value: unknown): string {
  const normalize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(normalize);
    if (input && typeof input === "object") {
      return Object.fromEntries(
        Object.entries(input as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, normalize(v)]),
      );
    }
    return input;
  };
  return JSON.stringify(normalize(value), null, 2);
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function checksumsFor(dataset: Dataset): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entity of DATASET_ENTITIES) {
    result[entity] = sha256(canonicalJson(dataset[entity] ?? []));
  }
  result.__dataset__ = sha256(canonicalJson(dataset));
  return result;
}

export function rowCounts(dataset: Dataset): Record<string, number> {
  return Object.fromEntries(DATASET_ENTITIES.map((entity) => [entity, (dataset[entity] ?? []).length]));
}
