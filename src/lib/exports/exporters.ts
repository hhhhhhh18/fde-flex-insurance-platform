import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ValidationReport } from "@/lib/validation/runner";
import { buildDataset, canonicalJson, checksumsFor, DATASET_ENTITIES, rowCounts, type Dataset } from "./dataset";
import { toCsv } from "./csv";

const sqlString = (value: unknown): string => {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return `'${String(value).replace(/'/g, "''")}'`;
};

/** Practical SQL seed for master data (products, options, factors). */
export function masterDataSql(dataset: Dataset): string {
  const lines = [
    "-- InsuranceLab master-data seed. Idempotent: safe to re-run.",
    'BEGIN;',
  ];
  for (const p of dataset.products ?? []) {
    lines.push(
      `INSERT INTO "Product" (id, code, name, category, status, description, "baseRate", "minimumPremium", "maxCoverageLimit", "referralThreshold", "autoBindLimit", "minAssetValue", "maxAssetValue", "minApplicantAge", "maxApplicantAge", "effectiveFrom", "effectiveTo", "pricingVersion", "rulesVersion", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, ${sqlString(p.code)}, ${sqlString(p.name)}, ${sqlString(p.category)}, ${sqlString(p.status)}, ${sqlString(p.description)}, ${sqlString(p.baseRate)}, ${sqlString(p.minimumPremium)}, ${sqlString(p.maxCoverageLimit)}, ${sqlString(p.referralThreshold)}, ${sqlString(p.autoBindLimit)}, ${sqlString(p.minAssetValue)}, ${sqlString(p.maxAssetValue)}, ${sqlString(p.minApplicantAge)}, ${sqlString(p.maxApplicantAge)}, ${sqlString(p.effectiveFrom)}, ${sqlString(p.effectiveTo)}, ${sqlString(p.pricingVersion)}, ${sqlString(p.rulesVersion)}, now(), now())
ON CONFLICT (code) DO NOTHING;`,
    );
  }
  for (const c of dataset.coverageOptions ?? []) {
    const idExpr = `(SELECT id FROM "Product" WHERE code = ${sqlString(c.productCode)})`;
    lines.push(
      `INSERT INTO "CoverageOption" (id, "productId", code, name, "coverageType", "rateFactor", "minLimit", "maxLimit", "defaultLimit", required, active, "createdAt")
VALUES (gen_random_uuid()::text, ${idExpr}, ${sqlString(c.code)}, ${sqlString(c.name)}, ${sqlString(c.coverageType)}, ${sqlString(c.rateFactor)}, ${sqlString(c.minLimit)}, ${sqlString(c.maxLimit)}, ${sqlString(c.defaultLimit)}, ${sqlString(c.required)}, ${sqlString(c.active)}, now())
ON CONFLICT ("productId", code) DO NOTHING;`,
    );
  }
  for (const f of dataset.riskFactors ?? []) {
    const productExpr = f.productCode
      ? `(SELECT id FROM "Product" WHERE code = ${sqlString(f.productCode)})`
      : "NULL";
    lines.push(
      `INSERT INTO "RiskFactor" (id, "productId", code, label, metric, operator, "thresholdValue", "thresholdText", multiplier, "triggersReferral", explanation, active)
VALUES (gen_random_uuid()::text, ${productExpr}, ${sqlString(f.code)}, ${sqlString(f.label)}, ${sqlString(f.metric)}, ${sqlString(f.operator)}, ${sqlString(f.thresholdValue)}, ${sqlString(f.thresholdText)}, ${sqlString(f.multiplier)}, ${sqlString(f.triggersReferral)}, ${sqlString(f.explanation)}, ${sqlString(f.active)})
ON CONFLICT (code) DO NOTHING;`,
    );
  }
  lines.push("COMMIT;");
  return `${lines.join("\n")}\n`;
}

export interface ExportManifest {
  datasetLabel: string;
  generatedAt: string;
  rowCounts: Record<string, number>;
  checksums: Record<string, string>;
  files: string[];
  deterministicFiles: string[];
  volatileFields: string[];
  notes: string[];
}

export interface ExportResult {
  dir: string;
  manifest: ExportManifest;
}

/**
 * Writes a full, self-describing export bundle.
 * Deterministic files (json/csv/checksums/ground-truth) must match byte-for-byte
 * across runs with the same seed; manifest.json is explicitly volatile.
 */
export async function writeDatasetExport(options: {
  dir: string;
  datasetLabel: string;
  validation?: ValidationReport;
  labels?: { anomalyCode: string; entityType: string; entityRef: string; expectedIssue: string; description: string }[];
}): Promise<ExportResult> {
  const dataset = await buildDataset();
  const jsonDir = join(options.dir, "json");
  const csvDir = join(options.dir, "csv");
  const sqlDir = join(options.dir, "sql");
  await Promise.all([mkdir(jsonDir, { recursive: true }), mkdir(csvDir, { recursive: true }), mkdir(sqlDir, { recursive: true })]);

  const files: string[] = [];
  for (const entity of DATASET_ENTITIES) {
    const rows = dataset[entity] ?? [];
    const jsonPath = join(jsonDir, `${entity}.json`);
    const csvPath = join(csvDir, `${entity}.csv`);
    await writeFile(jsonPath, `${canonicalJson(rows)}\n`, "utf8");
    await writeFile(csvPath, toCsv(rows), "utf8");
    files.push(jsonPath, csvPath);
  }

  const datasetPath = join(jsonDir, "dataset.json");
  await writeFile(datasetPath, `${canonicalJson(dataset)}\n`, "utf8");
  files.push(datasetPath);

  const sqlPath = join(sqlDir, "master-data.sql");
  await writeFile(sqlPath, masterDataSql(dataset), "utf8");
  files.push(sqlPath);

  const checksums = checksumsFor(dataset);
  const checksumPath = join(options.dir, "checksums.json");
  await writeFile(checksumPath, `${canonicalJson(checksums)}\n`, "utf8");
  files.push(checksumPath);

  if (options.validation) {
    const validationPath = join(options.dir, "validation-report.json");
    await writeFile(validationPath, `${canonicalJson(options.validation)}\n`, "utf8");
    files.push(validationPath);
  }

  if (options.labels) {
    const labelsPath = join(options.dir, "ground-truth", "labels.json");
    await mkdir(join(options.dir, "ground-truth"), { recursive: true });
    await writeFile(labelsPath, `${canonicalJson(options.labels)}\n`, "utf8");
    files.push(labelsPath);
  }

  const manifest: ExportManifest = {
    datasetLabel: options.datasetLabel,
    generatedAt: new Date().toISOString(),
    rowCounts: rowCounts(dataset),
    checksums,
    files: files.map((f) => f.replace(options.dir, "").replace(/\\/g, "/").replace(/^\//, "")),
    deterministicFiles: [
      "json/*.json",
      "csv/*.csv",
      "checksums.json",
      "ground-truth/labels.json",
      "sql/master-data.sql",
    ],
    volatileFields: ["manifest.generatedAt"],
    notes: [
      "Database surrogate ids are intentionally excluded; business references are the keys.",
      "Dates are normalised to YYYY-MM-DD and money to NUMERIC strings before hashing.",
      "All entities are ordered by their natural key so checksums are order-independent of insertion.",
    ],
  };

  const manifestPath = join(options.dir, "manifest.json");
  await writeFile(manifestPath, `${canonicalJson(manifest)}\n`, "utf8");

  return { dir: options.dir, manifest };
}
