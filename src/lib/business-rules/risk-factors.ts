import { dec } from "@/lib/money";
import type {
  AppliedFactor,
  AssetFacts,
  PricingInput,
  RiskFactorConfig,
} from "@/lib/pricing/types";
import { yearsBetween } from "./eligibility";

export interface ObservedMetric {
  value: number | string;
  display: string;
}

/** Reads the configured metric from the rating context. Returns null when the metric is unavailable. */
export function observeMetric(
  factor: RiskFactorConfig,
  input: Pick<PricingInput, "applicant" | "asset" | "asOf">,
): ObservedMetric | null {
  const asset: AssetFacts | null = input.asset;
  switch (factor.metric) {
    case "ASSET_AGE_YEARS":
      return asset ? { value: Number(input.asOf.slice(0, 4)) - asset.yearBuilt, display: `${Number(input.asOf.slice(0, 4)) - asset.yearBuilt} years` } : null;
    case "ASSET_VALUE":
      return asset ? { value: dec(asset.currentValue).toNumber(), display: dec(asset.currentValue).toFixed(2) } : null;
    case "CREDIT_BAND":
      return { value: input.applicant.creditBand, display: input.applicant.creditBand };
    case "OCCUPATION_CLASS":
      return { value: input.applicant.occupationClass, display: `class ${input.applicant.occupationClass}` };
    case "CLAIMS_HISTORY_5Y":
      return asset ? { value: asset.claimsHistory5y, display: `${asset.claimsHistory5y} claims` } : null;
    case "ASSET_CONDITION":
      return asset ? { value: asset.condition, display: asset.condition } : null;
    case "USAGE_TYPE":
      return asset ? { value: asset.usage, display: asset.usage } : null;
    default:
      return null;
  }
}

/** Applies one factor's operator to the observed metric. */
export function matchesFactor(factor: RiskFactorConfig, observed: ObservedMetric): boolean {
  const threshold = factor.thresholdValue === null ? null : dec(factor.thresholdValue);
  switch (factor.operator) {
    case "GTE":
      return typeof observed.value === "number" && threshold !== null
        ? dec(observed.value).gte(threshold)
        : false;
    case "LTE":
      return typeof observed.value === "number" && threshold !== null
        ? dec(observed.value).lte(threshold)
        : false;
    case "EQ":
      return String(observed.value).toUpperCase() === String(factor.thresholdText ?? "").toUpperCase();
    case "IN": {
      const allowed = String(factor.thresholdText ?? "")
        .split("|")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);
      return allowed.includes(String(observed.value).toUpperCase());
    }
    default:
      return false;
  }
}

export interface FactorEvaluation {
  applied: AppliedFactor[];
  skipped: { code: string; reason: string }[];
  age: number;
}

/**
 * Evaluates every configured factor that applies to the product (product-specific
 * plus global factors). Deterministic: order is by factor code.
 */
export function evaluateRiskFactors(input: PricingInput): FactorEvaluation {
  const applicable = input.riskFactors
    .filter((f) => f.active && (f.productCode === null || f.productCode === input.product.code))
    .sort((a, b) => a.code.localeCompare(b.code));

  const applied: AppliedFactor[] = [];
  const skipped: { code: string; reason: string }[] = [];

  for (const factor of applicable) {
    const observed = observeMetric(factor, input);
    if (!observed) {
      skipped.push({ code: factor.code, reason: `metric ${factor.metric} unavailable for this risk` });
      continue;
    }
    if (!matchesFactor(factor, observed)) {
      skipped.push({ code: factor.code, reason: `condition not met (observed ${observed.display})` });
      continue;
    }
    applied.push({
      code: factor.code,
      label: factor.label,
      metric: factor.metric,
      observed: observed.display,
      threshold:
        factor.thresholdValue !== null
          ? `${factor.operator} ${factor.thresholdValue}`
          : `${factor.operator} ${factor.thresholdText ?? ""}`,
      multiplier: factor.multiplier,
      triggersReferral: factor.triggersReferral,
      explanation: factor.explanation,
    });
  }

  return { applied, skipped, age: yearsBetween(input.applicant.dateOfBirth, input.asOf) };
}
