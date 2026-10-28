import { dec } from "@/lib/money";
import type { AppliedFactor, DecisionReason, PricingInput } from "@/lib/pricing/types";

export interface ReferralEvaluation {
  reasons: DecisionReason[];
  requiresReview: boolean;
}

/**
 * Deterministic underwriting referral thresholds.
 *  1. Gross premium above the product's configured referral threshold.
 *  2. Total coverage above the product's auto-bind (straight-through) limit.
 *  3. Any applied risk factor flagged triggersReferral.
 *  4. Explicitly high claims history (>= 3 in 5 years) even if no factor is configured.
 */
export function evaluateReferrals(
  input: PricingInput,
  grossPremium: string,
  totalCoverageLimit: string,
  appliedFactors: AppliedFactor[],
): ReferralEvaluation {
  const reasons: DecisionReason[] = [];
  const { product, asset } = input;

  if (dec(grossPremium).gt(dec(product.referralThreshold))) {
    reasons.push({
      code: "R_PREMIUM_ABOVE_THRESHOLD",
      category: "REFERRAL",
      severity: "MEDIUM",
      message: `Gross premium ${grossPremium} exceeds the auto-acceptance threshold ${product.referralThreshold}.`,
      observed: grossPremium,
      expected: `<= ${product.referralThreshold}`,
    });
  }

  if (dec(totalCoverageLimit).gt(dec(product.autoBindLimit))) {
    reasons.push({
      code: "R_COVERAGE_ABOVE_AUTOBIND",
      category: "REFERRAL",
      severity: "MEDIUM",
      message: `Total coverage ${totalCoverageLimit} exceeds the auto-bind limit ${product.autoBindLimit}.`,
      observed: totalCoverageLimit,
      expected: `<= ${product.autoBindLimit}`,
    });
  }

  for (const factor of appliedFactors) {
    if (factor.triggersReferral) {
      reasons.push({
        code: `R_FACTOR_${factor.code}`,
        category: "REFERRAL",
        severity: "MEDIUM",
        message: `${factor.label} triggered a referral (${factor.explanation}).`,
        observed: factor.observed,
        expected: factor.threshold,
      });
    }
  }

  if (asset && asset.claimsHistory5y >= 3) {
    reasons.push({
      code: "R_CLAIMS_HISTORY",
      category: "REFERRAL",
      severity: "MEDIUM",
      message: `Claims history of ${asset.claimsHistory5y} claims in 5 years requires review.`,
      observed: String(asset.claimsHistory5y),
      expected: "<= 2",
    });
  }

  return { reasons, requiresReview: reasons.length > 0 };
}
