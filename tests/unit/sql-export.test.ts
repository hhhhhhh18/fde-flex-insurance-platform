import { describe, expect, it } from "vitest";
import { masterDataSql } from "@/lib/exports/exporters";
import type { Dataset } from "@/lib/exports/dataset";

const dataset: Dataset = {
  products: [
    {
      code: "T-1",
      name: "O'Reilly Cover",
      category: "MOTOR",
      status: "ACTIVE",
      description: "test product",
      baseRate: "1.000000",
      minimumPremium: "100.00",
      maxCoverageLimit: "100000.00",
      referralThreshold: "5000.00",
      autoBindLimit: "50000.00",
      minAssetValue: "0.00",
      maxAssetValue: "100000.00",
      minApplicantAge: 18,
      maxApplicantAge: 80,
      effectiveFrom: "2024-01-01",
      effectiveTo: null,
      pricingVersion: "pricing-1",
      rulesVersion: "rules-1",
    },
  ],
  coverageOptions: [
    {
      productCode: "T-1",
      code: "C1",
      name: "Collision",
      coverageType: "COLLISION",
      rateFactor: "1.000000",
      minLimit: "1000.00",
      maxLimit: "100000.00",
      defaultLimit: "10000.00",
      required: true,
      active: true,
    },
  ],
  riskFactors: [
    {
      code: "F1",
      label: "Vehicle age",
      productCode: null,
      metric: "ASSET_AGE_YEARS",
      operator: "GTE",
      thresholdValue: "10",
      thresholdText: null,
      multiplier: "1.100000",
      triggersReferral: false,
      explanation: "Older vehicles carry more risk",
      active: true,
    },
  ],
};

describe("master-data SQL export", () => {
  it("wraps inserts in a single transaction and covers every configured table", () => {
    const sql = masterDataSql(dataset);

    expect(sql.startsWith("-- InsuranceLab master-data seed.")).toBe(true);
    expect(sql).toContain('BEGIN;');
    expect(sql.trimEnd().endsWith("COMMIT;")).toBe(true);
    expect(sql.match(/INSERT INTO/g)).toHaveLength(3);
    expect(sql).toContain('INSERT INTO "Product"');
    expect(sql).toContain('INSERT INTO "CoverageOption"');
    expect(sql).toContain('INSERT INTO "RiskFactor"');
  });

  it("is idempotent through ON CONFLICT clauses", () => {
    const sql = masterDataSql(dataset);
    expect(sql.match(/ON CONFLICT/g)).toHaveLength(3);
    expect(sql).toContain('ON CONFLICT (code) DO NOTHING');
    expect(sql).toContain('ON CONFLICT ("productId", code) DO NOTHING');
  });

  it("escapes single quotes and renders a null product scope for global factors", () => {
    const sql = masterDataSql(dataset);
    expect(sql).toContain("O''Reilly Cover");
    expect(sql).toContain("NULL, 'F1'");
  });

  it("produces byte-identical output for identical input", () => {
    expect(masterDataSql(dataset)).toBe(masterDataSql(dataset));
  });

  it("emits no rows when master data is absent", () => {
    const sql = masterDataSql({});
    expect(sql).not.toContain("INSERT INTO");
    expect(sql).toContain("BEGIN;");
  });
});
