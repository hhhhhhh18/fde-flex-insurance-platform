import "dotenv/config";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { sha256 } from "../src/lib/exports/dataset";

interface Checksums {
  [key: string]: string;
}

async function readChecksums(dir: string): Promise<Checksums> {
  const raw = await readFile(join(dir, "checksums.json"), "utf8");
  return JSON.parse(raw) as Checksums;
}

async function compareDirectory(a: string, b: string, sub: string): Promise<string[]> {
  const problems: string[] = [];
  let filesA: string[] = [];
  let filesB: string[] = [];
  try {
    filesA = (await readdir(join(a, sub))).sort();
    filesB = (await readdir(join(b, sub))).sort();
  } catch {
    return [`missing directory ${sub}`];
  }
  if (filesA.join("|") !== filesB.join("|")) {
    problems.push(`file sets differ in ${sub}/ (${filesA.length} vs ${filesB.length})`);
  }
  for (const file of filesA.filter((f) => filesB.includes(f))) {
    const [bufA, bufB] = await Promise.all([readFile(join(a, sub, file)), readFile(join(b, sub, file))]);
    if (sha256(bufA.toString("utf8")) !== sha256(bufB.toString("utf8"))) {
      problems.push(`byte mismatch: ${sub}/${file}`);
    }
  }
  return problems;
}

async function main() {
  const first = process.argv[2];
  const second = process.argv[3];
  if (!first || !second) {
    console.error("Usage: tsx scripts/compare-reproducibility.ts <export-dir-a> <export-dir-b>");
    process.exitCode = 2;
    return;
  }

  const [a, b] = await Promise.all([readChecksums(first), readChecksums(second)]);
  const keys = Array.from(new Set([...Object.keys(a), ...Object.keys(b)])).sort();
  const problems: string[] = [];

  for (const key of keys) {
    if (a[key] !== b[key]) problems.push(`checksum mismatch for ${key}: ${a[key] ?? "missing"} != ${b[key] ?? "missing"}`);
  }

  const fileProblems = [
    ...(await compareDirectory(first, second, "json")),
    ...(await compareDirectory(first, second, "csv")),
    ...(await compareDirectory(first, second, "sql")),
  ];

  const allProblems = [...problems, ...fileProblems];
  const match = allProblems.length === 0;

  // Publish the outcome so the dashboard can report a real reproducibility signal
  // instead of a placeholder.
  await mkdir("data", { recursive: true });
  await writeFile(
    join("data", "reproducibility.json"),
    `${JSON.stringify(
      {
        match,
        checkedAt: new Date().toISOString(),
        detail: match
          ? `${keys.length} checksums and all deterministic files match byte-for-byte.`
          : `${allProblems.length} problem(s): ${allProblems.slice(0, 5).join("; ")}`,
        directories: [first, second],
        datasetChecksum: a.__dataset__ ?? null,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  if (match) {
    console.log(`Reproducible: ${keys.length} checksums and all deterministic files match byte-for-byte.`);
    console.log("Recorded data/reproducibility.json");
    return;
  }

  console.error("NOT reproducible. Affected items:");
  for (const p of allProblems) console.error(`  - ${p}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
