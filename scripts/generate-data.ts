import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { generateDataset, type Scale } from "../src/lib/generator";
import { prisma } from "../src/lib/db";

function arg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : "true";
}

async function main() {
  const seed = Number(arg("seed", "20261001"));
  const scale = (arg("scale", "small") as Scale) ?? "small";
  const datasetLabel = arg("label", "baseline")!;
  const includeAnomalies = arg("no-anomalies") !== "true";
  const reset = arg("reset", "false") === "true";

  if (!["small", "full"].includes(scale)) throw new Error(`Unknown scale "${scale}" (use small|full)`);
  if (!Number.isInteger(seed) || seed < 0) throw new Error("--seed must be a non-negative integer");

  console.log(
    `Generating dataset label=${datasetLabel} scale=${scale} seed=${seed} anomalies=${includeAnomalies} reset=${reset}`,
  );

  const summary = await generateDataset({ seed, scale, datasetLabel, includeAnomalies, reset });

  await mkdir("data", { recursive: true });
  const outPath = join("data", `generation-${datasetLabel}.json`);
  await writeFile(outPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(summary.counts, null, 2));
  console.log(`Anomaly labels: ${summary.anomalies}`);
  if (summary.skipped.length > 0) {
    console.log(`Skipped operations: ${summary.skipped.length}`);
    for (const s of summary.skipped.slice(0, 10)) console.log(`  - ${s.reason}: ${s.detail}`);
  }
  console.log(`Done in ${summary.durationMs}ms. Summary written to ${outPath}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
