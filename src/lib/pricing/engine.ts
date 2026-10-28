import { Decimal, dec, factor as factorStr, money, round2, round6 } from "@/lib/money";
import { evaluateEligibility } from "@/lib/business-rules/eligibility";
import { evaluateReferrals } from "@/lib/business-rules/referral";
import { evaluateRiskFactors } from "@/lib/business-rules/risk-factors";
import {
  FACTOR_FLOOR,
  ROUNDING_NOTE,
  type CoverageLine,
  type DecisionReason,
  type PricingBreakdown,
  type PricingInput,
  type PricingResult,
} from "./types";

/**
 * THE premium formula. Every caller (API, generator, validation, tests) uses this
 * function; no premium arithmetic exists anywhere else.
 *
 *   exposureUnits_i  = requestedLimit_i / 1000
 *   contribution_i   = exposureUnits_i x baseRate x coverageRateFactor_i
 *   premiumAtBase    = SUM(contribution_i)
 *   factorProduct    = PRODUCT(applied risk multipliers), floored at FACTOR_FLOOR
 *   premiumAfter     = premiumAtBase x factorProduct
 *   netPremium       = round2(premiumAfter)
 *   grossPremium     = MAX(netPremium, product.minimumPremium)
 *
 * Limits that exceed a coverage option maximum are capped for pricing purposes
 * (approvedLimit) while the request itself is rejected as ineligible.
 */
export function priceQuote(input: PricingInput): PricingResult {
  const eligibility = evaluateEligibility(input);
  const { applied, skipped } = evaluateRiskFactors(input);

  const byCode = new Map(input.coverages.map((c) => [c.code, c]));
  const lines: CoverageLine[] = [];

  for (const request of input.requestedCoverages) {
    const option = byCode.get(request.code);
    if (!option) continue;
    const requested = dec(request.limit);
    const maxLimit = dec(option.maxLimit);
    const minLimit = dec(option.minLimit);
    const approved = Decimal.min(Decimal.max(requested, minLimit), maxLimit);
    const limitStatus: CoverageLine["limitStatus"] = requested.gt(maxLimit)
      ? "ABOVE_MAX"
      : requested.lt(minLimit)
        ? "BELOW_MIN"
        : "OK";
    const exposureUnits = round6(approved.div(1000));
    const contribution = round6(exposureUnits.times(dec(input.product.baseRate)).times(dec(option.rateFactor)));
    lines.push({
      code: option.code,
      coverageType: option.coverageType,
      requestedLimit: money(requested),
      approvedLimit: money(approved),
      rateFactor: factorStr(option.rateFactor),
      exposureUnits: exposureUnits.toFixed(6),
      contribution: contribution.toFixed(6),
      limitStatus,
    });
  }

  const exposureBase = lines.reduce<Decimal>((acc, l) => acc.plus(dec(l.exposureUnits)), new Decimal(0));
  const premiumAtBase = lines.reduce<Decimal>((acc, l) => acc.plus(dec(l.contribution)), new Decimal(0));

  let factorProduct = new Decimal(1);
  for (const f of applied) factorProduct = factorProduct.times(dec(f.multiplier));
  const floored = factorProduct.lt(dec(FACTOR_FLOOR));
  if (floored) factorProduct = dec(FACTOR_FLOOR);
  factorProduct = round6(factorProduct);

  const premiumAfterFactors = round6(premiumAtBase.times(factorProduct));
  const netPremium = round2(premiumAfterFactors);
  const minimum = dec(input.product.minimumPremium);
  const minimumApplied = netPremium.lt(minimum);
  const grossPremium = minimumApplied ? minimum : netPremium;

  const breakdown: PricingBreakdown = {
    baseRate: factorStr(input.product.baseRate),
    exposureBase: exposureBase.toFixed(6),
    premiumAtBase: premiumAtBase.toFixed(6),
    factors: applied,
    factorProduct: factorProduct.toFixed(6),
    factorFloorApplied: floored,
    premiumAfterFactors: premiumAfterFactors.toFixed(6),
    minimumPremium: money(minimum),
    minimumPremiumApplied: minimumApplied,
    netPremium: money(netPremium),
    grossPremium: money(grossPremium),
    rounding: {
      method: "HALF_UP",
      moneyDp: 2,
      factorDp: 6,
      note: ROUNDING_NOTE,
    },
    pricingVersion: input.product.pricingVersion,
    rulesVersion: input.product.rulesVersion,
    computedAt: input.asOf,
  };

  const referral = evaluateReferrals(
    input,
    breakdown.grossPremium,
    eligibility.totalCoverageLimit,
    applied,
  );

  let decision: PricingResult["decision"];
  const reasons: DecisionReason[] = [...eligibility.all];

  if (eligibility.blocking.length > 0) {
    decision = "INELIGIBLE";
  } else if (eligibility.dataQuality.length > 0) {
    decision = "AWAITING_INFORMATION";
  } else if (referral.requiresReview) {
    decision = "REFERRED";
    reasons.push(...referral.reasons);
  } else {
    decision = "ELIGIBLE";
    reasons.push({
      code: "OK_ELIGIBLE",
      category: "ELIGIBILITY",
      severity: "INFO",
      message: "Request satisfies product eligibility and auto-acceptance thresholds.",
    });
  }

  // Factors that were not applied are informative only, never decision inputs.
  for (const s of skipped) {
    reasons.push({
      code: `F_NOT_APPLIED_${s.code}`,
      category: "PRICING",
      severity: "INFO",
      message: `Rating factor ${s.code} not applied: ${s.reason}.`,
    });
  }

  return {
    decision,
    reasons,
    referrals: referral.reasons,
    coverages: lines,
    totalCoverageLimit: eligibility.totalCoverageLimit,
    breakdown,
    inputSnapshot: input,
  };
}

/** Recomputes a stored breakdown from its input snapshot (used by validation). */
export function recomputePremium(snapshot: PricingInput): { grossPremium: string; decision: string } {
  const result = priceQuote(snapshot);
  return { grossPremium: result.breakdown.grossPremium, decision: result.decision };
}
