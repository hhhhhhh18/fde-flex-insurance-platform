import type { NextRequest } from "next/server";
import { currentActor, ok, parseQuery, route } from "@/lib/api/http";
import { assertAuthorized } from "@/lib/authz";
import { exportQuerySchema } from "@/lib/validation/schemas";
import { buildDataset, DATASET_ENTITIES, type DatasetEntity } from "@/lib/exports/dataset";
import { toCsv } from "@/lib/exports/csv";
import { masterDataSql } from "@/lib/exports/exporters";
import { getReportSummary } from "@/lib/analytics/dashboard";
import { prisma } from "@/lib/db";


/**
 * GET /api/exports/data?entity=quotes&format=csv
 * Deterministic, reference-keyed export built from the same projection that
 * feeds checksums, so an API download matches the CLI bundle byte-for-byte.
 */
export const GET = route(async (req: NextRequest) => {
  const actor = await currentActor();
  assertAuthorized(actor.role, "export:read");

  const query = parseQuery(req, exportQuerySchema);
  const dataset = await buildDataset();
  const stamp = new Date().toISOString().slice(0, 10);

  // Master-data SQL seed (products, coverage options, rating factors). It is a
  // configuration seed, not a full relational dump; CSV/JSON cover transactions.
  if (query.format === "sql") {
    return new Response(masterDataSql(dataset), {
      status: 200,
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="insurancelab-master-data-${stamp}.sql"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (query.format === "json") {
    const payload =
      query.entity === "all"
        ? dataset
        : query.entity === "findings"
          ? await latestFindings()
          : { [query.entity]: dataset[query.entity as DatasetEntity] ?? [] };
    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="insurancelab-${query.entity}-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (query.entity === "findings") {
    const findings = await latestFindings();
    return new Response(toCsv(findings as Record<string, unknown>[]), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="insurancelab-findings-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (query.entity === "all") {
    // A single CSV cannot represent the whole relational dataset; return a
    // manifest-style summary instead of silently dropping entities.
    const summary = await getReportSummary();
    const rows = [
      { entity: "summary", key: "generatedAt", value: new Date().toISOString() },
      ...Object.keys(dataset).map((entity) => ({
        entity,
        key: "rowCount",
        value: String(dataset[entity as DatasetEntity]?.length ?? 0),
      })),
      ...summary.quotes.map((q) => ({ entity: "quotes", key: q.decision, value: `${q.count} / ${q.premium}` })),
    ];
    return new Response(toCsv(rows), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="insurancelab-summary-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  const entity = query.entity as DatasetEntity;
  if (!DATASET_ENTITIES.includes(entity)) {
    return ok({ error: { code: "UNKNOWN_ENTITY", message: `Unknown entity ${query.entity}` } }, 400);
  }

  return new Response(toCsv(dataset[entity] ?? []), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="insurancelab-${entity}-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});

async function latestFindings() {
  const run = await prisma.validationRun.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
    include: { findings: { orderBy: [{ entityRef: "asc" }, { issueCode: "asc" }] } },
  });
  return (run?.findings ?? []).map((f) => ({
    findingId: `${f.issueCode}:${f.entityRef}`,
    issueCode: f.issueCode,
    entityType: f.entityType,
    entityRef: f.entityRef,
    category: f.category,
    severity: f.severity,
    message: f.message,
    expectedValue: f.expectedValue,
    observedValue: f.observedValue,
    remediation: f.remediation,
  }));
}
