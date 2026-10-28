import { z } from "zod";

/** Shared primitives. All external input passes through these schemas. */
export const moneyString = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Expected a positive amount with up to 2 decimals");

export const idString = z.string().min(1).max(64);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(120).optional(),
  status: z.string().max(40).optional(),
  sort: z.string().max(40).optional(),
  dir: z.enum(["asc", "desc"]).default("desc"),
});

export const quoteCoverageSchema = z.object({
  code: z.string().min(1).max(40),
  limit: moneyString,
});

export const quoteEvaluateSchema = z.object({
  applicantId: idString,
  productId: idString,
  assetId: idString.optional().nullable(),
  coverages: z.array(quoteCoverageSchema).min(1, "Select at least one coverage").max(12),
  asOf: z.string().datetime().optional(),
});

export const policyIssueSchema = z.object({
  quoteId: idString,
  paymentConfirmed: z.boolean(),
  effectiveFrom: z.string().date().optional(),
  termMonths: z.coerce.number().int().min(6).max(36).default(12),
  paymentReference: z.string().max(60).optional(),
});

export const policyCancelSchema = z.object({
  policyId: idString,
  reason: z.string().min(5, "Provide a cancellation reason").max(300),
  effectiveDate: z.string().date().optional(),
});

export const endorsementSchema = z.object({
  policyId: idString,
  type: z.enum(["COVERAGE_UPDATE", "LIMIT_CHANGE", "ASSET_UPDATE"]),
  effectiveDate: z.string().date(),
  reason: z.string().min(5).max(300),
  newLimit: moneyString.optional(),
  coverageCode: z.string().max(40).optional(),
  newAssetValue: moneyString.optional(),
});

export const renewalGenerateSchema = z.object({
  policyId: idString,
  offerValidDays: z.coerce.number().int().min(7).max(90).default(30),
  termMonths: z.coerce.number().int().min(6).max(36).default(12),
});

export const renewalRespondSchema = z.object({
  renewalId: idString,
  action: z.enum(["ACCEPT", "DECLINE"]),
  reason: z.string().max(300).optional(),
});

export const underwritingDecisionSchema = z.object({
  decisionId: idString.optional(),
  quoteId: idString.optional(),
  outcome: z.enum(["APPROVED", "DECLINED", "INFORMATION_REQUESTED"]),
  notes: z.string().min(5, "Provide reviewer notes").max(1000),
  requestedInfo: z.string().max(300).optional(),
}).refine((v) => Boolean(v.decisionId ?? v.quoteId), {
  message: "decisionId or quoteId is required",
});

export const validationRunSchema = z.object({
  datasetLabel: z.string().max(60).default("operational"),
  persist: z.boolean().default(true),
});

export const exportQuerySchema = z.object({
  entity: z.enum([
    "applicants",
    "assets",
    "products",
    "quotes",
    "policies",
    "endorsements",
    "renewals",
    "underwriting",
    "findings",
    "all",
  ]).default("all"),
  format: z.enum(["json", "csv", "sql"]).default("json"),
  datasetLabel: z.string().max(60).optional(),
});

export const roleSchema = z.object({
  role: z.enum(["APPLICANT", "OPERATIONS_ANALYST", "RISK_REVIEWER", "ADMIN"]),
});

export type QuoteEvaluateInput = z.infer<typeof quoteEvaluateSchema>;
export type PolicyIssueInput = z.infer<typeof policyIssueSchema>;
export type EndorsementInput = z.infer<typeof endorsementSchema>;
export type RenewalGenerateInput = z.infer<typeof renewalGenerateSchema>;
export type UnderwritingInput = z.infer<typeof underwritingDecisionSchema>;
