import { describe, expect, it } from "vitest";
import { priceQuote } from "@/lib/pricing/engine";
import { makeInput, testProduct, creditFactor } from "../helpers/fixtures";
import type { RiskFactorConfig } from "@/lib/pricing/types";

describe("premium formula", () => {
  it("rates exposure units at the base rate", () => {
    const result = priceQuote(makeInput());

    // 100,000 limit => 100 units x 2.000000 = 200.00
    expect(result.breakdown.exposureBase).toBe("100.000000");
    expect(result.breakdown.premiumAtBase).toBe("200.000000");
    expect(result.breakdown.factorProduct).toBe("1.000000");
    expect(result.breakdown.grossPremium).toBe("200.00");
    expect(result.decision).toBe("ELIGIBLE");
  });

  it("applies each coverage rate factor to its own contribution", () => {
    const result = priceQuote(
      makeInput({
        requestedCoverages: [
          { code: "COL", limit: "100000.00" },
          { code: "THF", limit: "50000.00" },
        ],
      }),
    );

    // COL: 100 x 2 x 1.0 = 200 ; THF: 50 x 2 x 0.5 = 50
    expect(result.breakdown.premiumAtBase).toBe("250.000000");
    expect(result.breakdown.grossPremium).toBe("250.00");
  });

  it("multiplies configured risk factors", () => {
    const result = priceQuote(makeInput({ riskFactors: [creditFactor], applicant: { ...makeInput().applicant, creditBand: "D" } }));

    expect(result.breakdown.factors).toHaveLength(1);
    expect(result.breakdown.factorProduct).toBe("1.200000");
    expect(result.breakdown.grossPremium).toBe("240.00");
  });

  it("never drops the factor product below the 0.5 floor", () => {
    const cheapA: RiskFactorConfig = { ...creditFactor, code: "A", metric: "CREDIT_BAND", thresholdText: "A", multiplier: "0.600000" };
    const cheapB: RiskFactorConfig = { ...creditFactor, code: "B", metric: "USAGE_TYPE", operator: "EQ", thresholdText: "PERSONAL", multiplier: "0.600000" };

    const result = priceQuote(
      makeInput({
        riskFactors: [cheapA, cheapB],
        requestedCoverages: [{ code: "COL", limit: "200000.00" }],
      }),
    );

    expect(result.breakdown.factorProduct).toBe("0.500000");
    expect(result.breakdown.factorFloorApplied).toBe(true);
    // 400 at base x 0.5 floor = 200
    expect(result.breakdown.grossPremium).toBe("200.00");
  });

  it("applies the minimum premium when the rated amount is lower", () => {
    const result = priceQuote(makeInput({ requestedCoverages: [{ code: "COL", limit: "20000.00" }] }));

    expect(result.breakdown.premiumAfterFactors).toBe("40.000000");
    expect(result.breakdown.minimumPremiumApplied).toBe(true);
    expect(result.breakdown.grossPremium).toBe("150.00");
  });

  it("rounds HALF_UP to 2dp exactly once", () => {
    // 100 units x 2.345650 = 234.565 -> HALF_UP -> 234.57 (banker's rounding would give 234.56)
    const result = priceQuote(makeInput({ product: { ...testProduct, baseRate: "2.345650" } }));
    expect(result.breakdown.grossPremium).toBe("234.57");

    const recurring = priceQuote(makeInput({ product: { ...testProduct, baseRate: "1.234567" }, requestedCoverages: [{ code: "COL", limit: "200000.00" }] }));
    // 200 units x 1.234567 = 246.9134 -> 246.91
    expect(recurring.breakdown.grossPremium).toBe("246.91");
  });

  it("is deterministic for identical input", () => {
    const a = priceQuote(makeInput());
    const b = priceQuote(makeInput());
    expect(a.breakdown.grossPremium).toBe(b.breakdown.grossPremium);
    expect(a.breakdown.factorProduct).toBe(b.breakdown.factorProduct);
    expect(a.breakdown.factors).toEqual(b.breakdown.factors);
  });
});

describe("eligibility rules", () => {
  it("rejects coverage above the option maximum and clamps the approved limit", () => {
    const result = priceQuote(makeInput({ requestedCoverages: [{ code: "COL", limit: "600000.00" }] }));

    expect(result.decision).toBe("INELIGIBLE");
    expect(result.reasons.map((reason) => reason.code)).toContain("E_COVERAGE_LIMIT_ABOVE_MAX");
    expect(result.coverages[0].limitStatus).toBe("ABOVE_MAX");
    expect(result.coverages[0].approvedLimit).toBe("500000.00");
  });

  it("rejects coverage below the option minimum", () => {
    const result = priceQuote(makeInput({ requestedCoverages: [{ code: "COL", limit: "500.00" }] }));
    expect(result.decision).toBe("INELIGIBLE");
    expect(result.reasons.map((reason) => reason.code)).toContain("E_COVERAGE_LIMIT_BELOW_MIN");
  });

  it("requires mandatory coverages", () => {
    const result = priceQuote(makeInput({ requestedCoverages: [{ code: "THF", limit: "50000.00" }] }));
    expect(result.decision).toBe("INELIGIBLE");
    expect(result.reasons.map((reason) => reason.code)).toContain("E_REQUIRED_COVERAGE_MISSING");
  });

  it("rejects coverage belonging to another product", () => {
    const foreign = makeInput();
    foreign.coverages = foreign.coverages.map((coverage) =>
      coverage.code === "COL" ? { ...coverage, productCode: "OTHER-PRODUCT" } : coverage,
    );

    const result = priceQuote(foreign);
    expect(result.decision).toBe("INELIGIBLE");
    expect(result.reasons.map((reason) => reason.code)).toContain("E_COVERAGE_CROSS_PRODUCT");
  });

  it("rejects unknown coverage codes", () => {
    const result = priceQuote(makeInput({ requestedCoverages: [{ code: "NOPE", limit: "1000.00" }] }));
    expect(result.reasons.map((reason) => reason.code)).toContain("E_COVERAGE_UNKNOWN");
  });

  it("enforces the applicant age band at both boundaries", () => {
    const exactly18 = priceQuote(makeInput({ applicant: { ...makeInput().applicant, dateOfBirth: "2008-06-15" } }));
    expect(exactly18.decision).toBe("ELIGIBLE");

    const justUnder = priceQuote(makeInput({ applicant: { ...makeInput().applicant, dateOfBirth: "2008-06-16" } }));
    expect(justUnder.reasons.map((reason) => reason.code)).toContain("E_APPLICANT_AGE");

    const exactly85 = priceQuote(makeInput({ applicant: { ...makeInput().applicant, dateOfBirth: "1941-06-15" } }));
    expect(exactly85.decision).toBe("ELIGIBLE");

    const over85 = priceQuote(makeInput({ applicant: { ...makeInput().applicant, dateOfBirth: "1940-06-15" } }));
    expect(over85.reasons.map((reason) => reason.code)).toContain("E_APPLICANT_AGE");
  });

  it("rejects assets outside the product value band", () => {
    const result = priceQuote(makeInput({ asset: { ...makeInput().asset!, currentValue: "900000.00" } }));
    expect(result.reasons.map((reason) => reason.code)).toContain("E_ASSET_VALUE_RANGE");
  });

  it("rejects asset types the category cannot insure", () => {
    const result = priceQuote(
      makeInput({ product: { ...testProduct, category: "PROPERTY" } }),
    );
    expect(result.reasons.map((reason) => reason.code)).toContain("E_ASSET_TYPE_MISMATCH");
  });

  it("rejects retired products and products outside their effective window", () => {
    const retired = priceQuote(makeInput({ product: { ...testProduct, status: "RETIRED" } }));
    expect(retired.reasons.map((reason) => reason.code)).toContain("E_PRODUCT_STATUS");

    const future = priceQuote(makeInput({ product: { ...testProduct, effectiveFrom: "2027-01-01T00:00:00.000Z" } }));
    expect(future.reasons.map((reason) => reason.code)).toContain("E_PRODUCT_NOT_YET_EFFECTIVE");
  });

  it("holds quotes for information when risk data is incomplete", () => {
    const result = priceQuote(makeInput({ asset: { ...makeInput().asset!, riskDataComplete: false, missingRiskField: "flood_zone" } }));
    expect(result.decision).toBe("AWAITING_INFORMATION");
    expect(result.reasons.map((reason) => reason.code)).toContain("DQ_RISK_INFORMATION_MISSING");
    // Pricing still runs so the referrer can see an indicative premium.
    expect(Number(result.breakdown.grossPremium)).toBeGreaterThan(0);
  });
});

describe("referral thresholds", () => {
  it("refers premiums above the configured threshold", () => {
    const result = priceQuote(makeInput({ product: { ...testProduct, referralThreshold: "199.00" } }));
    expect(result.decision).toBe("REFERRED");
    expect(result.referrals.map((reason) => reason.code)).toContain("R_PREMIUM_ABOVE_THRESHOLD");
  });

  it("refers coverage above the auto-bind limit even when pricing is low", () => {
    const result = priceQuote(
      makeInput({
        product: { ...testProduct, referralThreshold: "100000.00" },
        requestedCoverages: [{ code: "COL", limit: "300000.00" }],
      }),
    );
    expect(result.decision).toBe("REFERRED");
    expect(result.referrals.map((reason) => reason.code)).toContain("R_COVERAGE_ABOVE_AUTOBIND");
  });

  it("refers when a matched factor is flagged as a referral trigger", () => {
    const factor: RiskFactorConfig = { ...creditFactor, triggersReferral: true, multiplier: "1.100000" };
    const result = priceQuote({ ...makeInput({ riskFactors: [factor] }), applicant: { ...makeInput().applicant, creditBand: "D" } });
    expect(result.decision).toBe("REFERRED");
  });

  it("does not refer a clean risk within all thresholds", () => {
    const result = priceQuote(makeInput());
    expect(result.referrals).toHaveLength(0);
    expect(result.decision).toBe("ELIGIBLE");
  });
});
