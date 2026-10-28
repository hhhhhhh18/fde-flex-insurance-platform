/** Response shapes returned by the existing REST endpoints (verified against live responses). */

export interface DashboardSummaryResponse {
  counts: {
    applicants: number;
    assets: number;
    products: number;
    quotes: number;
    policies: number;
    endorsements: number;
    renewals: number;
  };
  quotesByDecision: { decision: string; count: number }[];
  policiesByStatus: { status: string; count: number }[];
  renewalsByStatus: { status: string; count: number }[];
  underwriting: { pending: number; approved: number; declined: number };
  premiums: { quotedTotal: string; issuedTotal: string; averageQuoted: string };
  exceptions: {
    runId: string | null;
    ranAt: string | null;
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
  };
  validation: { status: "NOT_RUN" | "PASS" | "FAIL"; findings: number; ranAt: string | null };
  reproducibility: { status: "NOT_RUN" | "MATCH" | "MISMATCH"; checkedAt: string | null; detail: string | null };
  monthlyPremium: { month: string; quoted: string; issued: string }[];
  recentQuotes: { reference: string; applicant: string; product: string; decision: string; grossPremium: string }[];
  generatedAt: string;
}

export interface ReportSummaryResponse {
  quotes: { decision: string; count: number; premium: string }[];
  policies: { status: string; count: number; premium: string }[];
  renewals: { status: string; count: number; premium: string }[];
  findingsBySeverity: { severity: string; count: number }[];
  findingsByIssue: { issueCode: string; count: number }[];
  validationRun: { id: string; ranAt: string | null; findings: number } | null;
  groundTruthLabels: number;
  generatedAt: string;
  dataset: string;
}


/* ---------- Record models (JSON shapes returned by the REST API) ---------- */

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

export interface Applicant {
  id: string;
  reference: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  dateOfBirth: string;
  country: string;
  region: string;
  occupation: string;
  occupationClass: number;
  annualIncome: string;
  creditBand: string;
  _count?: { assets: number; quotes: number; policies: number };
}

export interface ApplicantSummary {
  reference: string;
  firstName: string;
  lastName: string;
}

export interface Asset {
  id: string;
  reference: string;
  assetType: string;
  description: string;
  yearBuilt: number;
  purchaseValue: string;
  currentValue: string;
  condition: string;
  usage: string;
  claimsHistory5y: number;
  region: string;
  riskDataComplete: boolean;
  missingRiskField: string | null;
  applicant?: ApplicantSummary;
  _count?: { quotes: number; policies: number };
}

export interface CoverageOption {
  id: string;
  code: string;
  name: string;
  coverageType: string;
  rateFactor: string;
  minLimit: string;
  maxLimit: string;
  defaultLimit: string;
  required: boolean;
  active: boolean;
}

export interface RiskFactor {
  id: string;
  code: string;
  label: string;
  metric: string;
  operator: string;
  thresholdValue: string | null;
  thresholdText: string | null;
  multiplier: string;
  triggersReferral: boolean;
  explanation: string;
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  status: string;
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
  effectiveTo: string | null;
  pricingVersion: string;
  rulesVersion: string;
  coverageOptions: CoverageOption[];
  riskFactors: RiskFactor[];
  _count?: { quotes: number; policies: number };
}

export interface ProductsResponse {
  items: Product[];
  globalRiskFactors: RiskFactor[];
}

export interface AppliedRiskFactor {
  id: string;
  observedValue: string;
  multiplier: string;
  referred: boolean;
  riskFactor?: RiskFactor;
}

export interface QuoteCoverage {
  id: string;
  requestedLimit: string;
  approvedLimit: string;
  rateFactor: string;
  limitViolation: boolean;
  coverageOption?: CoverageOption;
}

export interface PricingFactor {
  code: string;
  label: string;
  metric?: string;
  observed: string;
  threshold?: string;
  multiplier: string;
  explanation?: string;
  triggersReferral?: boolean;
}

export interface PricingBreakdown {
  baseRate: string;
  exposureBase: string;
  premiumAtBase: string;
  factors: PricingFactor[];
  factorProduct: string;
  factorFloorApplied?: boolean;
  premiumAfterFactors: string;
  minimumPremium: string;
  minimumPremiumApplied: boolean;
  netPremium: string;
  grossPremium: string;
  rounding: { method: string; moneyDp: number; factorDp: number; note: string };
  pricingVersion: string;
  rulesVersion: string;
  computedAt: string;
}

export interface Quote {
  id: string;
  reference: string;
  status: string;
  decision: string;
  decisionSummary: string;
  referralReasons: { code: string; message: string; category: string }[];
  pricingBreakdown: PricingBreakdown;
  coverageLimit: string;
  netPremium: string;
  grossPremium: string;
  factorProduct: string;
  pricingVersion: string;
  rulesVersion: string;
  evaluatedAt: string;
  expiresAt: string;
  applicant?: Applicant;
  product?: Product;
  asset?: Asset | null;
  coverages?: QuoteCoverage[];
  riskFactors?: AppliedRiskFactor[];
  policy?: Policy | null;
  underwriting?: { reference: string; status: string }[];
}

export interface Policy {
  id: string;
  reference: string;
  status: string;
  paymentStatus: string;
  effectiveFrom: string;
  effectiveTo: string;
  premium: string;
  coverageLimit: string;
  issuedAt: string;
  issuedByRole: string;
  issuedBy: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  version: number;
  applicant?: Applicant;
  product?: Product;
  asset?: Asset | null;
  quoteRef?: string;
}

export interface Renewal {
  id: string;
  reference: string;
  status: string;
  offeredPremium: string;
  effectiveFrom: string;
  effectiveTo: string;
  offerExpiresAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  declineReason: string | null;
  resultingPolicyId: string | null;
  policy?: Policy;
  resultingPolicy?: Policy | null;
}

export interface Endorsement {
  id: string;
  reference: string;
  type: string;
  status: string;
  effectiveDate: string;
  reason: string;
  requestedChanges: Record<string, unknown> | null;
  premiumDelta: string;
  approvedBy: string | null;
  approvedByRole: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  policy?: Policy;
}
