import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../src/lib/db";
import { buildDataset, canonicalJson, checksumsFor, rowCounts } from "../src/lib/exports/dataset";

/**
 * Read-only evidence capture. Writes a snapshot of the current operational
 * dataset plus the latest validation run. It never mutates operational tables.
 */
const OUT = join("data", "evidence");

async function main() {
  await mkdir(OUT, { recursive: true });

  const dataset = await buildDataset();
  const checksums = checksumsFor(dataset);
  const counts = rowCounts(dataset);

  const run = await prisma.validationRun.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
    include: { findings: { orderBy: [{ severity: "asc" }, { issueCode: "asc" }] } },
  });
  const labels = await prisma.anomalyLabel.findMany({ orderBy: [{ anomalyCode: "asc" }, { entityRef: "asc" }] });

  const phase3Quotes = await prisma.quote.findMany({
    where: { reference: { in: ["QTE-2026-00030", "QTE-2026-00031", "QTE-2026-00032"] } },
    select: { reference: true, decision: true, status: true, grossPremium: true, createdAt: true, product: { select: { code: true } } },
    orderBy: { reference: "asc" },
  });
  const phase3Decisions = await prisma.underwritingDecision.findMany({
    where: { reference: "UWD-2026-00001" },
    select: {
      reference: true,
      status: true,
      reviewerRole: true,
      decidedAt: true,
      quote: { select: { reference: true } },
      notes: true,
    },
  });

  const snapshot = {
    capturedAt: new Date().toISOString(),
    database: "insurancelab (working dataset, not reset)",
    rowCounts: counts,
    checksums,
    totals: {
      audits: await prisma.auditEvent.count(),
      validationRuns: await prisma.validationRun.count(),
      validationFindings: await prisma.validationFinding.count(),
      groundTruthLabels: labels.length,
    },
    phase3VerificationChanges: {
      quotes: phase3Quotes.map((quote) => ({ ...quote, grossPremium: quote.grossPremium.toString() })),
      underwritingDecisions: phase3Decisions.map((decision) => ({
        ...decision,
        authorityLimit: undefined,
      })),
    },
  };

  await writeFile(join(OUT, "dataset-snapshot.json"), `${canonicalJson(snapshot)}\n`, "utf8");

  await writeFile(
    join(OUT, "validation-latest.json"),
    `${canonicalJson({
      capturedAt: snapshot.capturedAt,
      run: run
        ? {
            id: run.id,
            status: run.status,
            datasetLabel: run.datasetLabel,
            startedAt: run.startedAt,
            finishedAt: run.finishedAt,
            checksRun: run.checksRun,
            findingsCount: run.findingsCount,
            summary: run.summary,
          }
        : null,
      findings: run?.findings ?? [],
      groundTruthLabels: labels,
    })}\n`,
    "utf8",
  );

  console.log(`Evidence written to ${OUT}`);
  console.log(`rows: ${JSON.stringify(counts)}`);
  console.log(`dataset checksum: ${checksums.__dataset__}`);
  console.log(`latest run: ${run?.id ?? "none"} findings=${run?.findings.length ?? 0} labels=${labels.length}`);
  console.log(`phase3 quotes: ${phase3Quotes.map((q) => `${q.reference}:${q.decision}`).join(", ") || "not found"}`);
  console.log(`phase3 decisions: ${phase3Decisions.map((d) => `${d.reference}:${d.status}`).join(", ") || "not found"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
