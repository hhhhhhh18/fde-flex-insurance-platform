import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { generateDataset } from "@/lib/generator";
import { buildDataset, canonicalJson, checksumsFor, DATASET_ENTITIES } from "@/lib/exports/dataset";
import { runValidation } from "@/lib/validation/runner";

const SEED = 909090;

async function generate() {
  return generateDataset({
    seed: SEED,
    scale: "small",
    datasetLabel: "determinism",
    includeAnomalies: true,
    reset: true,
  });
}

describe("deterministic generation", () => {
  it("produces identical counts and checksums for the same seed", async () => {
    const first = await generate();
    const datasetA = await buildDataset();
    const checksumsA = checksumsFor(datasetA);

    const second = await generate();
    const datasetB = await buildDataset();
    const checksumsB = checksumsFor(datasetB);

    expect(second.counts).toEqual(first.counts);
    expect(checksumsB).toEqual(checksumsA);
    expect(canonicalJson(datasetB)).toBe(canonicalJson(datasetA));
  }, 180_000);

  it("changes the dataset checksum for a different seed", async () => {
    await generate();
    const baseline = checksumsFor(await buildDataset());

    await generateDataset({ seed: SEED + 1, scale: "small", datasetLabel: "determinism", includeAnomalies: true, reset: true });
    const other = checksumsFor(await buildDataset());

    expect(other.__dataset__).not.toBe(baseline.__dataset__);
  }, 180_000);

  it("exports every declared entity", async () => {
    await generate();
    const dataset = await buildDataset();
    for (const entity of DATASET_ENTITIES) {
      expect(dataset[entity], `missing entity ${entity}`).toBeDefined();
      expect(Array.isArray(dataset[entity])).toBe(true);
    }
  }, 120_000);
});

describe("referential integrity of generated data", () => {
  it("has no orphaned foreign keys", async () => {
    await generate();

    const orphanAssets = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "InsuredAsset" a
      LEFT JOIN "Applicant" p ON p.id = a."applicantId"
      WHERE p.id IS NULL`;
    const orphanQuotes = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "Quote" q
      LEFT JOIN "Product" p ON p.id = q."productId"
      WHERE p.id IS NULL`;
    const orphanPolicies = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*)::bigint AS count FROM "Policy" p
      LEFT JOIN "Quote" q ON q.id = p."quoteId"
      WHERE q.id IS NULL`;

    expect(Number(orphanAssets[0].count)).toBe(0);
    expect(Number(orphanQuotes[0].count)).toBe(0);
    expect(Number(orphanPolicies[0].count)).toBe(0);
  }, 120_000);

  it("keeps business references unique", async () => {
    await generate();
    const duplicates = await prisma.$queryRaw<{ reference: string; count: bigint }[]>`
      SELECT reference, COUNT(*)::bigint AS count FROM "Quote" GROUP BY reference HAVING COUNT(*) > 1`;
    expect(duplicates).toHaveLength(0);
  }, 120_000);
});

describe("validation and ground-truth separation", () => {
  it("detects every injected anomaly", async () => {
    await generate();
    const report = await runValidation({ datasetLabel: "determinism", persist: false });

    expect(report.summary.totalFindings).toBeGreaterThanOrEqual(7);
    expect(report.groundTruth).not.toBeNull();
    expect(report.groundTruth!.missedCount).toBe(0);
    expect(report.groundTruth!.labels.every((label) => label.detected)).toBe(true);
    expect(report.groundTruth!.unlabelledFindings).toHaveLength(0);
  }, 180_000);

  it("produces the same findings without ground-truth labels", async () => {
    await generate();
    const withLabels = await runValidation({ datasetLabel: "determinism", persist: false });
    const before = withLabels.findings.map((finding) => `${finding.issueCode}|${finding.entityRef}`).sort();

    await prisma.anomalyLabel.deleteMany({});
    const withoutLabels = await runValidation({ datasetLabel: "determinism", persist: false });
    const after = withoutLabels.findings.map((finding) => `${finding.issueCode}|${finding.entityRef}`).sort();

    expect(after).toEqual(before);
    expect(withoutLabels.groundTruth?.labels ?? []).toHaveLength(0);
  }, 240_000);

  it("reports each finding with evidence and remediation", async () => {
    await generate();
    const report = await runValidation({ datasetLabel: "determinism", persist: false });

    for (const finding of report.findings) {
      expect(finding.issueCode).toMatch(/^[A-Z_]+$/);
      expect(finding.entityRef).toBeTruthy();
      expect(finding.message.length).toBeGreaterThan(10);
      expect(finding.remediation.length).toBeGreaterThan(5);
      expect(["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(finding.severity);
    }
  }, 180_000);
});

describe("export projection", () => {
  it("omits surrogate ids and volatile timestamps from every entity", async () => {
    await generate();
    const dataset = await buildDataset();

    for (const entity of DATASET_ENTITIES) {
      for (const row of dataset[entity] ?? []) {
        expect(row).not.toHaveProperty("id");
        expect(row).not.toHaveProperty("createdAt");
        expect(row).not.toHaveProperty("updatedAt");
      }
    }
  }, 180_000);

  it("keeps business references stable across regenerations", async () => {
    await generate();
    const before = (await buildDataset()).applicants.map((row) => row.reference);

    await generate();
    const after = (await buildDataset()).applicants.map((row) => row.reference);

    expect(after).toEqual(before);
    expect(after.length).toBeGreaterThan(0);
  }, 180_000);
});

describe("ground-truth label resolution", () => {
  it("resolves the dataset's own label when the requested label has none", async () => {
    await generate(); // labels are written under the "determinism" label
    const report = await runValidation({ datasetLabel: "operational", persist: false });

    expect(report.datasetLabel).toBe("determinism");
    expect(report.groundTruth.labels.length).toBeGreaterThan(0);
    expect(report.groundTruth.detectedCount).toBe(report.groundTruth.labels.length);
    expect(report.groundTruth.unlabelledFindings).toHaveLength(0);
  }, 120_000);
});
