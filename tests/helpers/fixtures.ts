import type {
  CoverageConfig,
  CoverageRequest,
  PricingInput,
  ProductConfig,
  RiskFactorConfig,
} from "@/lib/pricing/types";

export const AS_OF = "2026-06-15T00:00:00.000Z";

export const testProduct: ProductConfig = {
  code: "TST-MOTOR",
  name: "Test Motor",
  category: "MOTOR",
  status: "ACTIVE",
  baseRate: "2.000000",
  minimumPremium: "150.00",
  maxCoverageLimit: "500000.00",
  referralThreshold: "5000.00",
  autoBindLimit: "250000.00",
  minAssetValue: "1000.00",
  maxAssetValue: "300000.00",
  minApplicantAge: 18,
  maxApplicantAge: 85,
  effectiveFrom: "2025-01-01T00:00:00.000Z",
  effectiveTo: null,
  pricingVersion: "pricing-test-1",
  rulesVersion: "rules-test-1",
};

export const testCoverages: CoverageConfig[] = [
  {
    code: "COL",
    coverageType: "COLLISION",
    rateFactor: "1.000000",
    minLimit: "1000.00",
    maxLimit: "500000.00",
    defaultLimit: "100000.00",
    required: true,
    active: true,
    productCode: "TST-MOTOR",
  },
  {
    code: "THF",
    coverageType: "THEFT_FIRE",
    rateFactor: "0.500000",
    minLimit: "1000.00",
    maxLimit: "200000.00",
    defaultLimit: "50000.00",
    required: false,
    active: true,
    productCode: "TST-MOTOR",
  },
];

export const creditFactor: RiskFactorConfig = {
  code: "RF_CREDIT_D",
  label: "Credit band D",
  productCode: null,
  metric: "CREDIT_BAND",
  operator: "EQ",
  thresholdValue: null,
  thresholdText: "D",
  multiplier: "1.200000",
  triggersReferral: false,
  explanation: "Sub-prime credit band",
  active: true,
};

export function makeInput(overrides: Partial<PricingInput> = {}): PricingInput {
  const requestedCoverages: CoverageRequest[] = [
    { code: "COL", limit: "100000.00" },
  ];

  const input: PricingInput = {
    product: { ...testProduct },
    applicant: {
      dateOfBirth: "1985-04-10",
      creditBand: "A",
      occupationClass: 2,
      region: "EU-WEST",
    },
    asset: {
      assetType: "VEHICLE",
      yearBuilt: 2020,
      currentValue: "50000.00",
      condition: "GOOD",
      usage: "PERSONAL",
      claimsHistory5y: 0,
      riskDataComplete: true,
      missingRiskField: null,
    },
    coverages: testCoverages.map((coverage) => ({ ...coverage })),
    requestedCoverages,
    riskFactors: [],
    asOf: AS_OF,
    maxCoverageLimitOverride: null,
  };

  return { ...input, ...overrides };
}
