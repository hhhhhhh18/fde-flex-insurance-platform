import type { Tx } from "@/lib/db";
import { prisma } from "@/lib/db";

export type RefPrefix = "APP" | "AST" | "QTE" | "POL" | "END" | "RNW" | "UWD";

const PAD = 5;

export function formatReference(prefix: RefPrefix, year: number, sequence: number): string {
  return `${prefix}-${year}-${String(sequence).padStart(PAD, "0")}`;
}

/** Increments a database counter atomically inside the caller's transaction. */
export async function nextSequence(tx: Tx, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Counter" ("key", "value", "updatedAt")
    VALUES (${key}, 1, now())
    ON CONFLICT ("key") DO UPDATE
      SET "value" = "Counter"."value" + 1, "updatedAt" = now()
    RETURNING "value";
  `;
  return rows[0]?.value ?? 1;
}

/** Allocates the next immutable business identifier, e.g. POL-2026-00042. */
export async function nextReference(tx: Tx, prefix: RefPrefix, at: Date = new Date()): Promise<string> {
  const year = at.getUTCFullYear();
  const sequence = await nextSequence(tx, `${prefix}-${year}`);
  return formatReference(prefix, year, sequence);
}

/** Builds a reference without touching the counter - used by the deterministic generator. */
export function referenceFor(prefix: RefPrefix, year: number, sequence: number): string {
  return formatReference(prefix, year, sequence);
}

/** Current counter values (diagnostics / reproducibility manifest). */
export async function readCounters(): Promise<Record<string, number>> {
  const rows = await prisma.counter.findMany({ orderBy: { key: "asc" } });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
