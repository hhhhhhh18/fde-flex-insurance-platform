/**
 * Master data for the synthetic portfolio: products, coverage options, and the
 * configurable rating/referral factors. These are also the rate tables the
 * pricing engine consumes; nothing here is randomised.
 */

export interface ProductSeed {
  code: string;
  name: string;
  category: "MOTOR" | "PROPERTY" | "CYBER" | "LIABILITY";
  description: string;
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
  pricingVersion: string;
  rulesVersion: string;
  coverages: {
    code: string;
    name: string;
    coverageType:
      | "COLLISION"
      | "THEFT"
      | "FIRE"
      | "FLOOD"
      | "EARTHQUAKE"
      | "GENERAL_LIABILITY"
      | "BUSINESS_INTERRUPTION"
      | "CYBER_INCIDENT";
    rateFactor: string;
    minLimit: string;
    maxLimit: string;
    defaultLimit: string;
    required: boolean;
  }[];
}

export const PRODUCT_SEEDS: ProductSeed[] = [
  {
    code: "MOT-FLEET",
    name: "Fleet Flex Motor",
    category: "MOTOR",
    description: "Commercial and personal vehicle cover with collision, theft and third-party liability.",
    baseRate: "3.200000",
    minimumPremium: "180.00",
    maxCoverageLimit: "500000.00",
    referralThreshold: "12000.00",
    autoBindLimit: "250000.00",
    minAssetValue: "5000.00",
    maxAssetValue: "300000.00",
    minApplicantAge: 18,
    maxApplicantAge: 80,
    effectiveFrom: "2024-01-01",
    pricingVersion: "motor-2026.1",
    rulesVersion: "rules-2026.1",
    coverages: [
      { code: "MOT-COL", name: "Collision", coverageType: "COLLISION", rateFactor: "1.000000", minLimit: "10000.00", maxLimit: "300000.00", defaultLimit: "60000.00", required: true },
      { code: "MOT-THF", name: "Theft", coverageType: "THEFT", rateFactor: "0.650000", minLimit: "5000.00", maxLimit: "200000.00", defaultLimit: "40000.00", required: false },
      { code: "MOT-FIR", name: "Fire", coverageType: "FIRE", rateFactor: "0.450000", minLimit: "5000.00", maxLimit: "200000.00", defaultLimit: "35000.00", required: false },
      { code: "MOT-LIA", name: "Third-party liability", coverageType: "GENERAL_LIABILITY", rateFactor: "0.300000", minLimit: "25000.00", maxLimit: "250000.00", defaultLimit: "100000.00", required: true },
    ],
  },
  {
    code: "PROP-SHIELD",
    name: "Property Shield Commercial",
    category: "PROPERTY",
    description: "Commercial property cover for buildings, machinery and solar assets.",
    baseRate: "1.850000",
    minimumPremium: "240.00",
    maxCoverageLimit: "2000000.00",
    referralThreshold: "18000.00",
    autoBindLimit: "750000.00",
    minAssetValue: "20000.00",
    maxAssetValue: "3000000.00",
    minApplicantAge: 21,
    maxApplicantAge: 85,
    effectiveFrom: "2024-03-01",
    pricingVersion: "property-2026.2",
    rulesVersion: "rules-2026.1",
    coverages: [
      { code: "PRP-FIR", name: "Fire and allied perils", coverageType: "FIRE", rateFactor: "1.000000", minLimit: "50000.00", maxLimit: "2000000.00", defaultLimit: "400000.00", required: true },
      { code: "PRP-FLD", name: "Flood", coverageType: "FLOOD", rateFactor: "0.750000", minLimit: "25000.00", maxLimit: "1000000.00", defaultLimit: "200000.00", required: false },
      { code: "PRP-EQK", name: "Earthquake", coverageType: "EARTHQUAKE", rateFactor: "0.900000", minLimit: "25000.00", maxLimit: "1000000.00", defaultLimit: "150000.00", required: false },
      { code: "PRP-BI", name: "Business interruption", coverageType: "BUSINESS_INTERRUPTION", rateFactor: "0.550000", minLimit: "20000.00", maxLimit: "800000.00", defaultLimit: "120000.00", required: false },
    ],
  },
  {
    code: "CYB-GUARD",
    name: "Cyber Guard SME",
    category: "CYBER",
    description: "Cyber incident response and business interruption cover for small and mid-size enterprises.",
    baseRate: "2.400000",
    minimumPremium: "300.00",
    maxCoverageLimit: "1000000.00",
    referralThreshold: "15000.00",
    autoBindLimit: "400000.00",
    minAssetValue: "10000.00",
    maxAssetValue: "1500000.00",
    minApplicantAge: 18,
    maxApplicantAge: 85,
    effectiveFrom: "2024-06-01",
    pricingVersion: "cyber-2026.3",
    rulesVersion: "rules-2026.1",
    coverages: [
      { code: "CYB-INC", name: "Cyber incident response", coverageType: "CYBER_INCIDENT", rateFactor: "1.000000", minLimit: "50000.00", maxLimit: "1000000.00", defaultLimit: "250000.00", required: true },
      { code: "CYB-BI", name: "Business interruption", coverageType: "BUSINESS_INTERRUPTION", rateFactor: "0.600000", minLimit: "25000.00", maxLimit: "500000.00", defaultLimit: "100000.00", required: false },
      { code: "CYB-LIA", name: "Third-party liability", coverageType: "GENERAL_LIABILITY", rateFactor: "0.350000", minLimit: "25000.00", maxLimit: "500000.00", defaultLimit: "100000.00", required: false },
    ],
  },
  {
    code: "LIA-FLEX",
    name: "Professional Liability Flex",
    category: "LIABILITY",
    description: "Professional indemnity cover available with or without a scheduled asset.",
    baseRate: "1.200000",
    minimumPremium: "200.00",
    maxCoverageLimit: "1500000.00",
    referralThreshold: "10000.00",
    autoBindLimit: "500000.00",
    minAssetValue: "0.00",
    maxAssetValue: "3000000.00",
    minApplicantAge: 18,
    maxApplicantAge: 85,
    effectiveFrom: "2024-01-01",
    pricingVersion: "liability-2026.1",
    rulesVersion: "rules-2026.1",
    coverages: [
      { code: "LIA-IND", name: "Professional indemnity", coverageType: "GENERAL_LIABILITY", rateFactor: "1.000000", minLimit: "50000.00", maxLimit: "1500000.00", defaultLimit: "300000.00", required: true },
      { code: "LIA-BI", name: "Business interruption", coverageType: "BUSINESS_INTERRUPTION", rateFactor: "0.400000", minLimit: "20000.00", maxLimit: "500000.00", defaultLimit: "80000.00", required: false },
    ],
  },
];

export interface RiskFactorSeed {
  code: string;
  label: string;
  productCode: string | null;
  metric:
    | "ASSET_AGE_YEARS"
    | "ASSET_VALUE"
    | "CREDIT_BAND"
    | "OCCUPATION_CLASS"
    | "CLAIMS_HISTORY_5Y"
    | "ASSET_CONDITION"
    | "USAGE_TYPE";
  operator: "GTE" | "LTE" | "EQ" | "IN";
  thresholdValue: string | null;
  thresholdText: string | null;
  multiplier: string;
  triggersReferral: boolean;
  explanation: string;
}

export const RISK_FACTOR_SEEDS: RiskFactorSeed[] = [
  {
    code: "AGE_10Y",
    label: "Asset age over 10 years",
    productCode: null,
    metric: "ASSET_AGE_YEARS",
    operator: "GTE",
    thresholdValue: "10",
    thresholdText: null,
    multiplier: "1.150000",
    triggersReferral: false,
    explanation: "Older assets carry higher frequency and severity of loss.",
  },
  {
    code: "AGE_25Y",
    label: "Asset age over 25 years",
    productCode: null,
    metric: "ASSET_AGE_YEARS",
    operator: "GTE",
    thresholdValue: "25",
    thresholdText: null,
    multiplier: "1.350000",
    triggersReferral: true,
    explanation: "Assets older than 25 years require individual underwriting review.",
  },
  {
    code: "CLAIMS_2",
    label: "Two or more claims in 5 years",
    productCode: null,
    metric: "CLAIMS_HISTORY_5Y",
    operator: "GTE",
    thresholdValue: "2",
    thresholdText: null,
    multiplier: "1.250000",
    triggersReferral: false,
    explanation: "Claims frequency above the portfolio average.",
  },
  {
    code: "CLAIMS_3",
    label: "Three or more claims in 5 years",
    productCode: null,
    metric: "CLAIMS_HISTORY_5Y",
    operator: "GTE",
    thresholdValue: "3",
    thresholdText: null,
    multiplier: "1.450000",
    triggersReferral: true,
    explanation: "Persistent claims history requires human underwriting judgement.",
  },
  {
    code: "CREDIT_D",
    label: "Credit band D",
    productCode: null,
    metric: "CREDIT_BAND",
    operator: "EQ",
    thresholdValue: null,
    thresholdText: "D",
    multiplier: "1.200000",
    triggersReferral: false,
    explanation: "Sub-prime credit band increases payment and fraud risk.",
  },
  {
    code: "CREDIT_E",
    label: "Credit band E",
    productCode: null,
    metric: "CREDIT_BAND",
    operator: "EQ",
    thresholdValue: null,
    thresholdText: "E",
    multiplier: "1.450000",
    triggersReferral: true,
    explanation: "Lowest credit band is not eligible for straight-through processing.",
  },
  {
    code: "COND_POOR",
    label: "Poor asset condition",
    productCode: null,
    metric: "ASSET_CONDITION",
    operator: "EQ",
    thresholdValue: null,
    thresholdText: "POOR",
    multiplier: "1.300000",
    triggersReferral: true,
    explanation: "Poor condition materially increases expected loss.",
  },
  {
    code: "USE_COMM",
    label: "Commercial usage",
    productCode: null,
    metric: "USAGE_TYPE",
    operator: "EQ",
    thresholdValue: null,
    thresholdText: "COMMERCIAL",
    multiplier: "1.100000",
    triggersReferral: false,
    explanation: "Commercial exposure carries higher utilisation and liability.",
  },
  {
    code: "OCC_4",
    label: "Occupation class 4",
    productCode: null,
    metric: "OCCUPATION_CLASS",
    operator: "GTE",
    thresholdValue: "4",
    thresholdText: null,
    multiplier: "1.150000",
    triggersReferral: false,
    explanation: "Highest-risk occupation grouping.",
  },
  {
    code: "MOT_HIGH_VALUE",
    label: "Motor asset value over 150,000",
    productCode: "MOT-FLEET",
    metric: "ASSET_VALUE",
    operator: "GTE",
    thresholdValue: "150000",
    thresholdText: null,
    multiplier: "1.200000",
    triggersReferral: true,
    explanation: "High-value vehicles need engineer inspection before binding.",
  },
];

export const FIRST_NAMES = [
  "Aarav", "Mira", "Jonas", "Priya", "Tomas", "Lena", "Rahul", "Sofia", "Noah", "Aisha",
  "Diego", "Hana", "Omar", "Elena", "Yusuf", "Clara", "Viktor", "Nadia", "Mateo", "Ines",
  "Kofi", "Anya", "Ravi", "Mei", "Lucas", "Fatima", "Igor", "Sana", "Pavel", "Zara",
];

export const LAST_NAMES = [
  "Kapoor", "Lindqvist", "Okafor", "Nakamura", "Silva", "Haddad", "Novak", "Fischer", "Rao", "Costa",
  "Ivanov", "Mensah", "Duarte", "Kaur", "Berg", "Moreau", "Petrov", "Sato", "Adeyemi", "Khan",
];

export const REGIONS = ["EU-WEST", "EU-NORTH", "EU-SOUTH", "UK", "NA-EAST", "NA-WEST", "APAC", "MEA"];

export const OCCUPATIONS: { title: string; occupationClass: number }[] = [
  { title: "Software engineer", occupationClass: 1 },
  { title: "Accountant", occupationClass: 1 },
  { title: "Teacher", occupationClass: 1 },
  { title: "Retail manager", occupationClass: 2 },
  { title: "Logistics coordinator", occupationClass: 2 },
  { title: "Electrician", occupationClass: 3 },
  { title: "Construction supervisor", occupationClass: 3 },
  { title: "Freelance contractor", occupationClass: 4 },
  { title: "Seasonal labourer", occupationClass: 4 },
];

export const CREDIT_BANDS: { value: string; weight: number }[] = [
  { value: "A", weight: 30 },
  { value: "B", weight: 32 },
  { value: "C", weight: 22 },
  { value: "D", weight: 11 },
  { value: "E", weight: 5 },
];

export const ASSET_TYPES = ["VEHICLE", "BUILDING", "SOLAR_PLANT", "IT_INFRASTRUCTURE", "MACHINERY"] as const;

export const ASSET_DESCRIPTIONS: Record<string, string[]> = {
  VEHICLE: ["Ford Transit fleet van", "Toyota Corolla hybrid", "Mercedes Sprinter", "Renault Kangoo", "Volvo FH tractor unit"],
  BUILDING: ["Warehouse unit B7", "Retail premises, 2 floors", "Office block, 4 floors", "Cold storage facility"],
  SOLAR_PLANT: ["Rooftop solar array 250kW", "Ground-mount solar farm 1.2MW", "Solar carport installation"],
  IT_INFRASTRUCTURE: ["Primary data rack cluster", "Managed switch stack", "Backup SAN and tape library"],
  MACHINERY: ["CNC milling line", "Packaging conveyor system", "Industrial press, 40t"],
};
