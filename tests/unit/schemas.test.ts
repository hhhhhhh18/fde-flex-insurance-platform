import { describe, expect, it } from "vitest";
import {
  endorsementSchema,
  exportQuerySchema,
  paginationSchema,
  policyIssueSchema,
  quoteEvaluateSchema,
  renewalGenerateSchema,
  underwritingDecisionSchema,
} from "@/lib/validation/schemas";

describe("request validation", () => {
  it("accepts a well-formed quote request", () => {
    const parsed = quoteEvaluateSchema.parse({
      applicantId: "app_1",
      productId: "prod_1",
      assetId: null,
      coverages: [{ code: "COL", limit: "100000.00" }],
    });
    expect(parsed.coverages).toHaveLength(1);
  });

  it("rejects an empty coverage list", () => {
    expect(() =>
      quoteEvaluateSchema.parse({ applicantId: "a", productId: "p", coverages: [] }),
    ).toThrow(/at least one coverage/i);
  });

  it("rejects malformed money and negative limits", () => {
    for (const limit of ["-1", "1.234", "1e5", "", "abc"]) {
      expect(() =>
        quoteEvaluateSchema.parse({ applicantId: "a", productId: "p", coverages: [{ code: "COL", limit }] }),
      ).toThrow();
    }
  });

  it("caps the number of coverage lines", () => {
    const coverages = Array.from({ length: 13 }, (_, index) => ({ code: `C${index}`, limit: "1000.00" }));
    expect(() => quoteEvaluateSchema.parse({ applicantId: "a", productId: "p", coverages })).toThrow();
  });

  it("clamps pagination and rejects out-of-range page sizes", () => {
    expect(paginationSchema.parse({}).pageSize).toBe(20);
    expect(paginationSchema.parse({ pageSize: "100" }).pageSize).toBe(100);
    expect(() => paginationSchema.parse({ pageSize: "101" })).toThrow();
    expect(() => paginationSchema.parse({ page: "0" })).toThrow();
  });

  it("requires a cancellation reason and a boolean payment flag", () => {
    expect(() => policyIssueSchema.parse({ quoteId: "q", paymentConfirmed: "yes" })).toThrow();
    expect(policyIssueSchema.parse({ quoteId: "q", paymentConfirmed: true }).termMonths).toBe(12);
  });

  it("restricts endorsement types and renewal term bounds", () => {
    expect(() =>
      endorsementSchema.parse({ policyId: "p", type: "MAGIC", effectiveDate: "2026-01-01", reason: "because" }),
    ).toThrow();
    expect(() => renewalGenerateSchema.parse({ policyId: "p", termMonths: "3" })).toThrow();
  });

  it("requires reviewer notes on underwriting decisions", () => {
    expect(() =>
      underwritingDecisionSchema.parse({ decisionId: "d", outcome: "APPROVED", notes: "ok" }),
    ).toThrow(/notes/i);
    expect(() =>
      underwritingDecisionSchema.parse({ outcome: "APPROVED", notes: "adequate notes" }),
    ).toThrow(/decisionId or quoteId/);
  });

  it("only allows the documented export formats", () => {
    expect(exportQuerySchema.parse({ format: "sql" }).format).toBe("sql");
    expect(() => exportQuerySchema.parse({ format: "xml" })).toThrow();
    expect(() => exportQuerySchema.parse({ entity: "secrets" })).toThrow();
  });
});
