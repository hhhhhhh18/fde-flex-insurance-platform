import type { Applicant, CoverageOption, InsuredAsset, Product, RiskFactor } from "@prisma/client";
import { prisma } from "@/lib/db";
import { NotFoundError } from "@/lib/errors";
import type { PricingInput } from "@/lib/pricing/types";
import type { Tx } from "@/lib/db";

export type ProductWithOptions = Product & { coverageOptions: CoverageOption[] };

export interface PricingContext {
  input: PricingInput;
  ids: {
    coverageOptions: Record<string, string>;
    riskFactors: Record<string, string>;
  };
  records: {
    applicant: Applicant;
    product: ProductWithOptions;
    asset: InsuredAsset | null;
  };
}

const isoDate = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export async function loadPricingContext(
  params: { applicantId: string; productId: string; assetId?: string | null; asOf?: string },
  tx: Tx | typeof prisma = prisma,
): Promise<PricingContext> {
  const applicant = await tx.applicant.findUnique({ where: { id: params.applicantId } });
  if (!applicant) throw new NotFoundError("Applicant", params.applicantId);

  const product = await tx.product.findUnique({
    where: { id: params.productId },
    include: { coverageOptions: true },
  });
  if (!product) throw new NotFoundError("Product", params.productId);

  let asset: InsuredAsset | null = null;
  if (params.assetId) {
    asset = await tx.insuredAsset.findUnique({ where: { id: params.assetId } });
    if (!asset) throw new NotFoundError("InsuredAsset", params.assetId);
    if (asset.applicantId !== applicant.id) {
      throw new NotFoundError("InsuredAsset", params.assetId);
    }
  }

  const factors: RiskFactor[] = await tx.riskFactor.findMany({
    where: { active: true, OR: [{ productId: product.id }, { productId: null }] },
    orderBy: { code: "asc" },
  });

  const input: PricingInput = {
    product: {
      code: product.code,
      name: product.name,
      category: product.category,
      status: product.status,
      baseRate: product.baseRate.toString(),
      minimumPremium: product.minimumPremium.toString(),
      maxCoverageLimit: product.maxCoverageLimit.toString(),
      referralThreshold: product.referralThreshold.toString(),
      autoBindLimit: product.autoBindLimit.toString(),
      minAssetValue: product.minAssetValue.toString(),
      maxAssetValue: product.maxAssetValue.toString(),
      minApplicantAge: product.minApplicantAge,
      maxApplicantAge: product.maxApplicantAge,
      effectiveFrom: isoDate(product.effectiveFrom) ?? "1970-01-01",
      effectiveTo: isoDate(product.effectiveTo),
      pricingVersion: product.pricingVersion,
      rulesVersion: product.rulesVersion,
    },
    applicant: {
      dateOfBirth: isoDate(applicant.dateOfBirth) ?? "1970-01-01",
      creditBand: applicant.creditBand,
      occupationClass: applicant.occupationClass,
      region: applicant.region,
    },
    asset: asset
      ? {
          assetType: asset.assetType,
          yearBuilt: asset.yearBuilt,
          currentValue: asset.currentValue.toString(),
          condition: asset.condition,
          usage: asset.usage,
          claimsHistory5y: asset.claimsHistory5y,
          riskDataComplete: asset.riskDataComplete,
          missingRiskField: asset.missingRiskField,
        }
      : null,
    coverages: product.coverageOptions.map((c) => ({
      code: c.code,
      coverageType: c.coverageType,
      rateFactor: c.rateFactor.toString(),
      minLimit: c.minLimit.toString(),
      maxLimit: c.maxLimit.toString(),
      defaultLimit: c.defaultLimit.toString(),
      required: c.required,
      active: c.active,
      productCode: product.code,
    })),
    requestedCoverages: [],
    riskFactors: factors.map((f) => ({
      code: f.code,
      label: f.label,
      productCode: f.productId ? product.code : null,
      metric: f.metric,
      operator: f.operator,
      thresholdValue: f.thresholdValue ? f.thresholdValue.toString() : null,
      thresholdText: f.thresholdText,
      multiplier: f.multiplier.toString(),
      triggersReferral: f.triggersReferral,
      explanation: f.explanation,
      active: f.active,
    })),
    asOf: params.asOf ?? new Date().toISOString(),
  };

  return {
    input,
    ids: {
      coverageOptions: Object.fromEntries(product.coverageOptions.map((c) => [c.code, c.id])),
      riskFactors: Object.fromEntries(factors.map((f) => [f.code, f.id])),
    },
    records: { applicant, product, asset },
  };
}

/** Policy term helpers: dates are stored as DATE, so all math is UTC day-based. */
export function addMonths(dateIso: string, months: number): string {
  const d = new Date(dateIso);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const daysInTarget = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, daysInTarget));
  return d.toISOString().slice(0, 10);
}

export function addDays(dateIso: string, days: number): string {
  const d = new Date(dateIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function dateOnly(value: string | Date): Date {
  const iso = typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
  return new Date(`${iso}T00:00:00.000Z`);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((dateOnly(toIso).getTime() - dateOnly(fromIso).getTime()) / 86_400_000);
}
