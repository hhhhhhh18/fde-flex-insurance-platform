import "dotenv/config";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runValidation, renderSummary } from "../src/lib/validation/runner";
import { prisma } from "../src/lib/db";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "true";
}

async function main() {
  const datasetLabel = arg("label", "baseline")!;
  const outDir = arg("out", "data/validation")!;

  const report = await runValidation({ datasetLabel, persist: true });
  console.log(renderSummary(report));

  await mkdir(outDir, { recursive: true });
  const path = join(outDir, `validation-${datasetLabel}.json`);
  await writeFile(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`\nMachine-readable report: ${path}`);

  const failures: string[] = [];
  if (report.groundTruth.missedCount > 0) failures.push(`${report.groundTruth.missedCount} labelled anomalies were not detected`);
  if (report.groundTruth.unlabelledFindings.length > 0) {
    failures.push(`${report.groundTruth.unlabelledFindings.length} findings have no ground-truth label`);
  }

  if (failures.length > 0) {
    console.error(`\nVALIDATION FAILED: ${failures.join("; ")}`);
    process.exitCode = 1;
  } else {
    console.log("\nValidation checks consistent with ground truth.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
