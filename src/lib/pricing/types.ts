/**
 * Pricing input/output contracts.
 *
 * The engine is deliberately persistence-agnostic: services map Prisma records
 * into these structs, and the generator + validation reuse the exact same
 * structures. There is one premium formula in the codebase (engine.ts).
 */

export type DecisionCode = "ELIGIBLE" | "INELIGIBLE" | "REFERRED" | "AWAITING_INFORMATION";

export type ReasonCategory =
  | "ELIGIBILITY"
  | "COVERAGE"
  | "REFERRAL"
  | "DATA_QUALITY"
  | "PRICING"
  | "AUTHORITY";

export interface DecisionReason {
  code: string;
  category: ReasonCategory;
  message: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  observed?: string;
  expected?: string;
}

export interface ProductConfig {
  code: string;
  name: string;
  category: string;
  status: string;
  /** Premium per 1,000 of coverage limit. */
  baseRate: string;
  minimumPremium: string;
  maxCoverageLimit: string;
  referralThreshold: string;
  autoBindLimit: string;
  minAssetValue: string;
  maxAssetValue: string;
  minApplicantAge: number;
  maxApplicantAge: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  pricingVersion: string;
  rulesVersion: string;
}

export interface CoverageConfig {
  code: string;
  coverageType: string;
  rateFactor: string;
  minLimit: string;
  maxLimit: string;
  defaultLimit: string;
  required: boolean;
  active: boolean;
  /** Product the option belongs to; used to reject cross-product coverage. */
  productCode: string;
}

export interface CoverageRequest {
  code: string;
  limit: string;
}

export interface ApplicantFacts {
  dateOfBirth: string;
  creditBand: string;
  occupationClass: number;
  region: string;
}

export interface AssetFacts {
  assetType: string;
  yearBuilt: number;
  currentValue: string;
  condition: string;
  usage: string;
  claimsHistory5y: number;
  riskDataComplete: boolean;
  missingRiskField?: string | null;
}

export type RiskMetric =
  | "ASSET_AGE_YEARS"
  | "ASSET_VALUE"
  | "CREDIT_BAND"
  | "OCCUPATION_CLASS"
  | "CLAIMS_HISTORY_5Y"
  | "ASSET_CONDITION"
  | "USAGE_TYPE";

export type ComparisonOperator = "GTE" | "LTE" | "EQ" | "IN";

export interface RiskFactorConfig {
  code: string;
  label: string;
  productCode: string | null;
  metric: RiskMetric;
  operator: ComparisonOperator;
  thresholdValue: string | null;
  thresholdText: string | null;
  multiplier: string;
  triggersReferral: boolean;
  explanation: string;
  active: boolean;
}

export interface PricingInput {
  product: ProductConfig;
  applicant: ApplicantFacts;
  asset: AssetFacts | null;
  coverages: CoverageConfig[];
  requestedCoverages: CoverageRequest[];
  riskFactors: RiskFactorConfig[];
  /** Evaluation date; drives age and product-effective checks. */
  asOf: string;
  /** Optional applicant currency check / max coverage override. */
  maxCoverageLimitOverride?: string | null;
}

export interface CoverageLine {
  code: string;
  coverageType: string;
  requestedLimit: string;
  approvedLimit: string;
  rateFactor: string;
  exposureUnits: string;
  contribution: string;
  limitStatus: "OK" | "BELOW_MIN" | "ABOVE_MAX";
}

export interface AppliedFactor {
  code: string;
  label: string;
  metric: string;
  observed: string;
  threshold: string;
  multiplier: string;
  triggersReferral: boolean;
  explanation: string;
}

export interface PricingBreakdown {
  baseRate: string;
  exposureBase: string;
  premiumAtBase: string;
  factors: AppliedFactor[];
  factorProduct: string;
  factorFloorApplied: boolean;
  premiumAfterFactors: string;
  minimumPremium: string;
  minimumPremiumApplied: boolean;
  netPremium: string;
  grossPremium: string;
  rounding: { method: "HALF_UP"; moneyDp: 2; factorDp: 6; note: string };
  pricingVersion: string;
  rulesVersion: string;
  computedAt: string;
}

export interface PricingResult {
  decision: DecisionCode;
  reasons: DecisionReason[];
  referrals: DecisionReason[];
  coverages: CoverageLine[];
  totalCoverageLimit: string;
  breakdown: PricingBreakdown;
  /** Reproducible snapshot of every input used - stored with the quote. */
  inputSnapshot: PricingInput;
}

export const FACTOR_FLOOR = "0.500000";
export const MONEY_DP = 2;
export const FACTOR_DP = 6;
export const ROUNDING_NOTE =
  "Intermediate rating values are rounded HALF_UP to 6dp; the payable premium is rounded HALF_UP to 2dp exactly once, after all factors are applied.";
