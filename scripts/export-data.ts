import "dotenv/config";
import { join } from "node:path";
import { writeDatasetExport } from "../src/lib/exports/exporters";
import { runValidation } from "../src/lib/validation/runner";
import { prisma } from "../src/lib/db";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "true";
}

async function main() {
  const datasetLabel = arg("label", "baseline")!;
  const dir = arg("out", join("data", "exports", datasetLabel))!;

  const validation = await runValidation({ datasetLabel, persist: false });
  const labels = await prisma.anomalyLabel.findMany({
    where: { datasetLabel },
    orderBy: [{ anomalyCode: "asc" }, { entityRef: "asc" }],
    select: { anomalyCode: true, entityType: true, entityRef: true, expectedIssue: true, description: true },
  });

  const result = await writeDatasetExport({ dir, datasetLabel, validation, labels });

  console.log(`Exported ${result.manifest.files.length} files to ${result.dir}`);
  console.log("Row counts:", JSON.stringify(result.manifest.rowCounts));
  console.log("Dataset checksum:", result.manifest.checksums.__dataset__);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
