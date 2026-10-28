import { dec } from "@/lib/money";
import type { DecisionReason, PricingInput } from "@/lib/pricing/types";

/** Which asset types each product category may insure. */
export const ALLOWED_ASSET_TYPES: Record<string, string[]> = {
  MOTOR: ["VEHICLE"],
  PROPERTY: ["BUILDING", "MACHINERY", "SOLAR_PLANT"],
  CYBER: ["IT_INFRASTRUCTURE"],
  LIABILITY: ["BUILDING", "MACHINERY", "SOLAR_PLANT", "IT_INFRASTRUCTURE", "VEHICLE"],
};

export interface EligibilityResult {
  /** Blocking failures make the request ineligible. */
  blocking: DecisionReason[];
  /** Data-quality gaps make the request await additional information. */
  dataQuality: DecisionReason[];
  all: DecisionReason[];
  age: number;
  totalCoverageLimit: string;
}

export function yearsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  let age = to.getUTCFullYear() - from.getUTCFullYear();
  const monthDiff = to.getUTCMonth() - from.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && to.getUTCDate() < from.getUTCDate())) age -= 1;
  return age;
}

export function evaluateEligibility(input: PricingInput): EligibilityResult {
  const blocking: DecisionReason[] = [];
  const dataQuality: DecisionReason[] = [];
  const { product, applicant, asset, coverages, requestedCoverages, asOf } = input;

  const age = yearsBetween(applicant.dateOfBirth, asOf);

  if (product.status !== "ACTIVE") {
    blocking.push({
      code: "E_PRODUCT_STATUS",
      category: "ELIGIBILITY",
      severity: "HIGH",
      message: `Product ${product.code} is not active (status ${product.status}).`,
      observed: product.status,
      expected: "ACTIVE",
    });
  }

  const asOfDate = new Date(asOf);
  if (asOfDate < new Date(product.effectiveFrom)) {
    blocking.push({
      code: "E_PRODUCT_NOT_YET_EFFECTIVE",
      category: "ELIGIBILITY",
      severity: "HIGH",
      message: `Product ${product.code} is not effective until ${product.effectiveFrom}.`,
      observed: asOf,
      expected: `>= ${product.effectiveFrom}`,
    });
  }
  if (product.effectiveTo && asOfDate > new Date(product.effectiveTo)) {
    blocking.push({
      code: "E_PRODUCT_RETIRED",
      category: "ELIGIBILITY",
      severity: "HIGH",
      message: `Product ${product.code} stopped accepting business on ${product.effectiveTo}.`,
      observed: asOf,
      expected: `<= ${product.effectiveTo}`,
    });
  }

  if (age < product.minApplicantAge || age > product.maxApplicantAge) {
    blocking.push({
      code: "E_APPLICANT_AGE",
      category: "ELIGIBILITY",
      severity: "HIGH",
      message: `Applicant age ${age} is outside the product's accepted range ${product.minApplicantAge}-${product.maxApplicantAge}.`,
      observed: String(age),
      expected: `${product.minApplicantAge}-${product.maxApplicantAge}`,
    });
  }

  if (!["A", "B", "C", "D", "E"].includes(applicant.creditBand)) {
    blocking.push({
      code: "E_CREDIT_BAND_INVALID",
      category: "ELIGIBILITY",
      severity: "HIGH",
      message: `Credit band "${applicant.creditBand}" is not a recognised band.`,
      observed: applicant.creditBand,
      expected: "A|B|C|D|E",
    });
  }

  if (requestedCoverages.length === 0) {
    blocking.push({
      code: "E_NO_COVERAGE_REQUESTED",
      category: "COVERAGE",
      severity: "HIGH",
      message: "At least one coverage option must be requested.",
      observed: "0",
      expected: ">= 1",
    });
  }

  const allowedAssets = ALLOWED_ASSET_TYPES[product.category] ?? [];
  if (asset) {
    if (!allowedAssets.includes(asset.assetType)) {
      blocking.push({
        code: "E_ASSET_TYPE_MISMATCH",
        category: "ELIGIBILITY",
        severity: "HIGH",
        message: `Asset type ${asset.assetType} cannot be insured under category ${product.category}.`,
        observed: asset.assetType,
        expected: allowedAssets.join("|"),
      });
    }
    const value = dec(asset.currentValue);
    if (value.lt(dec(product.minAssetValue)) || value.gt(dec(product.maxAssetValue))) {
      blocking.push({
        code: "E_ASSET_VALUE_RANGE",
        category: "ELIGIBILITY",
        severity: "HIGH",
        message: `Asset value ${value.toFixed(2)} is outside the accepted range ${product.minAssetValue}-${product.maxAssetValue}.`,
        observed: value.toFixed(2),
        expected: `${product.minAssetValue}-${product.maxAssetValue}`,
      });
    }
    if (!asset.riskDataComplete) {
      dataQuality.push({
        code: "DQ_RISK_INFORMATION_MISSING",
        category: "DATA_QUALITY",
        severity: "MEDIUM",
        message: `Risk information is incomplete for the insured asset (missing: ${asset.missingRiskField ?? "unspecified"}).`,
        observed: asset.missingRiskField ?? "missing",
        expected: "complete risk questionnaire",
      });
    }
  } else if (product.category !== "LIABILITY") {
    blocking.push({
      code: "E_ASSET_REQUIRED",
      category: "ELIGIBILITY",
      severity: "HIGH",
      message: `Product category ${product.category} requires an insured asset.`,
      observed: "none",
      expected: allowedAssets.join("|"),
    });
  }

  // Coverage-level validation: membership, required options, and limits.
  const byCode = new Map(coverages.map((c) => [c.code, c]));
  const seen = new Set<string>();
  let totalLimit = dec(0);

  for (const request of requestedCoverages) {
    const option = byCode.get(request.code);
    if (!option) {
      blocking.push({
        code: "E_COVERAGE_UNKNOWN",
        category: "COVERAGE",
        severity: "HIGH",
        message: `Coverage "${request.code}" is not offered by product ${product.code}.`,
        observed: request.code,
        expected: coverages.map((c) => c.code).join("|"),
      });
      continue;
    }
    if (option.productCode !== product.code) {
      blocking.push({
        code: "E_COVERAGE_CROSS_PRODUCT",
        category: "COVERAGE",
        severity: "HIGH",
        message: `Coverage "${request.code}" belongs to product ${option.productCode}, not ${product.code}.`,
        observed: option.productCode,
        expected: product.code,
      });
      continue;
    }
    if (!option.active) {
      blocking.push({
        code: "E_COVERAGE_INACTIVE",
        category: "COVERAGE",
        severity: "HIGH",
        message: `Coverage "${request.code}" is no longer available.`,
        observed: "inactive",
        expected: "active",
      });
      continue;
    }
    if (seen.has(option.code)) {
      blocking.push({
        code: "E_COVERAGE_DUPLICATE",
        category: "COVERAGE",
        severity: "MEDIUM",
        message: `Coverage "${request.code}" was requested more than once.`,
        observed: "duplicate",
        expected: "unique",
      });
      continue;
    }
    seen.add(option.code);

    const limit = dec(request.limit);
    totalLimit = totalLimit.plus(limit);
    if (limit.lt(dec(option.minLimit))) {
      blocking.push({
        code: "E_COVERAGE_LIMIT_BELOW_MIN",
        category: "COVERAGE",
        severity: "HIGH",
        message: `Requested limit ${limit.toFixed(2)} for ${option.code} is below the minimum ${option.minLimit}.`,
        observed: limit.toFixed(2),
        expected: `>= ${option.minLimit}`,
      });
    }
    if (limit.gt(dec(option.maxLimit))) {
      blocking.push({
        code: "E_COVERAGE_LIMIT_ABOVE_MAX",
        category: "COVERAGE",
        severity: "HIGH",
        message: `Requested limit ${limit.toFixed(2)} for ${option.code} exceeds the maximum ${option.maxLimit}.`,
        observed: limit.toFixed(2),
        expected: `<= ${option.maxLimit}`,
      });
    }
  }

  for (const option of coverages) {
    if (option.required && option.active && !seen.has(option.code)) {
      blocking.push({
        code: "E_REQUIRED_COVERAGE_MISSING",
        category: "COVERAGE",
        severity: "HIGH",
        message: `Required coverage "${option.code}" was not requested.`,
        observed: "missing",
        expected: option.code,
      });
    }
  }

  const maxCoverage = dec(input.maxCoverageLimitOverride ?? product.maxCoverageLimit);
  if (totalLimit.gt(maxCoverage)) {
    blocking.push({
      code: "E_TOTAL_COVERAGE_ABOVE_PRODUCT_MAX",
      category: "COVERAGE",
      severity: "HIGH",
      message: `Total requested coverage ${totalLimit.toFixed(2)} exceeds the product maximum ${maxCoverage.toFixed(2)}.`,
      observed: totalLimit.toFixed(2),
      expected: `<= ${maxCoverage.toFixed(2)}`,
    });
  }

  return {
    blocking,
    dataQuality,
    all: [...blocking, ...dataQuality],
    age,
    totalCoverageLimit: totalLimit.toFixed(2),
  };
}
