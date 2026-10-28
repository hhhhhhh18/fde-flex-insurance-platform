import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db";
import { money } from "@/lib/money";

export interface DashboardSummary {
  counts: {
    applicants: number;
    assets: number;
    products: number;
    quotes: number;
    policies: number;
    endorsements: number;
    renewals: number;
  };
  quotesByDecision: { decision: string; count: number }[];
  policiesByStatus: { status: string; count: number }[];
  renewalsByStatus: { status: string; count: number }[];
  underwriting: { pending: number; approved: number; declined: number };
  premiums: { quotedTotal: string; issuedTotal: string; averageQuoted: string };
  exceptions: { runId: string | null; ranAt: string | null; total: number; bySeverity: Record<string, number>; byCategory: Record<string, number> };
  validation: { status: "NOT_RUN" | "PASS" | "FAIL"; findings: number; ranAt: string | null };
  reproducibility: { status: "NOT_RUN" | "MATCH" | "MISMATCH"; checkedAt: string | null; detail: string | null };
  monthlyPremium: { month: string; quoted: string; issued: string }[];
  recentQuotes: { reference: string; applicant: string; product: string; decision: string; grossPremium: string }[];
}

const groupToObject = (rows: { status?: string; decision?: string; _count: { _all: number } }[], key: "status" | "decision") =>
  rows.map((row) => ({ [key]: row[key] ?? "UNKNOWN", count: row._count._all })) as never;

async function readReproducibility(): Promise<DashboardSummary["reproducibility"]> {
  try {
    const raw = await readFile(join(process.cwd(), "data", "reproducibility.json"), "utf8");
    const parsed = JSON.parse(raw) as { match: boolean; checkedAt: string; detail?: string };
    return {
      status: parsed.match ? "MATCH" : "MISMATCH",
      checkedAt: parsed.checkedAt,
      detail: parsed.detail ?? null,
    };
  } catch {
    return { status: "NOT_RUN", checkedAt: null, detail: null };
  }
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const [
    applicants,
    assets,
    products,
    quotes,
    policies,
    endorsements,
    renewals,
    quoteGroups,
    policyGroups,
    renewalGroups,
    uwGroups,
    quotedAgg,
    issuedAgg,
    latestRun,
    recentQuotes,
    monthly,
  ] = await Promise.all([
    prisma.applicant.count(),
    prisma.insuredAsset.count(),
    prisma.product.count(),
    prisma.quote.count(),
    prisma.policy.count(),
    prisma.endorsement.count(),
    prisma.renewal.count(),
    prisma.quote.groupBy({ by: ["decision"], _count: { _all: true } }),
    prisma.policy.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.renewal.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.underwritingDecision.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.quote.aggregate({ _sum: { grossPremium: true }, _avg: { grossPremium: true } }),
    prisma.policy.aggregate({ _sum: { premium: true }, where: { status: { not: "CANCELLED" } } }),
    prisma.validationRun.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { finishedAt: "desc" },
      include: { findings: { select: { severity: true, category: true } } },
    }),
    prisma.quote.findMany({
      orderBy: { evaluatedAt: "desc" },
      take: 8,
      include: { applicant: { select: { firstName: true, lastName: true } }, product: { select: { name: true } } },
    }),
    prisma.$queryRaw<{ month: Date; quoted: string | null; issued: string | null }[]>`
      WITH months AS (
        SELECT date_trunc('month', d)::date AS month
        FROM generate_series(
          date_trunc('month', (CURRENT_DATE - INTERVAL '5 months')),
          date_trunc('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS d
      )
      SELECT m.month,
             (SELECT COALESCE(SUM(q."grossPremium"), 0)::text FROM "Quote" q
                WHERE date_trunc('month', q."evaluatedAt") = m.month) AS quoted,
             (SELECT COALESCE(SUM(p.premium), 0)::text FROM "Policy" p
                WHERE p.status <> 'CANCELLED' AND date_trunc('month', p."effectiveFrom") = m.month) AS issued
      FROM months m ORDER BY m.month;
    `,
  ]);

  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  for (const finding of latestRun?.findings ?? []) {
    bySeverity[finding.severity] = (bySeverity[finding.severity] ?? 0) + 1;
    byCategory[finding.category] = (byCategory[finding.category] ?? 0) + 1;
  }

  const uwStatus = (status: string) =>
    uwGroups.filter((g) => g.status === status).reduce((sum, g) => sum + g._count._all, 0);

  return {
    counts: {
      applicants,
      assets,
      products,
      quotes,
      policies,
      endorsements,
      renewals,
    },
    quotesByDecision: groupToObject(quoteGroups, "decision") as { decision: string; count: number }[],
    policiesByStatus: groupToObject(policyGroups, "status") as { status: string; count: number }[],
    renewalsByStatus: groupToObject(renewalGroups, "status") as { status: string; count: number }[],
    underwriting: {
      pending: uwStatus("PENDING") + uwStatus("INFORMATION_REQUESTED"),
      approved: uwStatus("APPROVED"),
      declined: uwStatus("DECLINED"),
    },
    premiums: {
      quotedTotal: money(quotedAgg._sum.grossPremium ?? 0),
      issuedTotal: money(issuedAgg._sum.premium ?? 0),
      averageQuoted: money(quotedAgg._avg.grossPremium ?? 0),
    },
    exceptions: {
      runId: latestRun?.id ?? null,
      ranAt: latestRun?.finishedAt?.toISOString() ?? null,
      total: latestRun?.findingsCount ?? 0,
      bySeverity,
      byCategory,
    },
    validation: {
      status: latestRun ? ((latestRun.findingsCount ?? 0) > 0 ? "FAIL" : "PASS") : "NOT_RUN",
      findings: latestRun?.findingsCount ?? 0,
      ranAt: latestRun?.finishedAt?.toISOString() ?? null,
    },
    reproducibility: await readReproducibility(),
    monthlyPremium: monthly.map((row) => ({
      month: row.month.toISOString().slice(0, 7),
      quoted: money(row.quoted ?? 0),
      issued: money(row.issued ?? 0),
    })),
    recentQuotes: recentQuotes.map((q) => ({
      reference: q.reference,
      applicant: `${q.applicant.firstName} ${q.applicant.lastName}`,
      product: q.product.name,
      decision: q.decision,
      grossPremium: q.grossPremium.toString(),
    })),
  };
}

/** Report-level metrics used by /reports and the exports endpoint. */
export async function getReportSummary() {
  // Only the latest completed run is reported, so counts never double-count findings.
  const validationRun = await prisma.validationRun.findFirst({
    where: { status: "COMPLETED" },
    orderBy: { finishedAt: "desc" },
  });
  const runFilter = validationRun ? { runId: validationRun.id } : { runId: "__none__" };

  const [decisions, policyStatuses, renewalStatuses, severity, issueCodes, labels] = await Promise.all([
    prisma.quote.groupBy({ by: ["decision"], _count: { _all: true }, _sum: { grossPremium: true } }),
    prisma.policy.groupBy({ by: ["status"], _count: { _all: true }, _sum: { premium: true } }),
    prisma.renewal.groupBy({ by: ["status"], _count: { _all: true }, _sum: { offeredPremium: true } }),
    prisma.validationFinding.groupBy({ by: ["severity"], _count: { _all: true }, where: runFilter }),
    prisma.validationFinding.groupBy({ by: ["issueCode"], _count: { _all: true }, where: runFilter }),
    prisma.anomalyLabel.count(),
  ]);

  return {
    quotes: decisions.map((d) => ({
      decision: d.decision,
      count: d._count._all,
      premium: money(d._sum.grossPremium ?? 0),
    })),
    policies: policyStatuses.map((p) => ({
      status: p.status,
      count: p._count._all,
      premium: money(p._sum.premium ?? 0),
    })),
    renewals: renewalStatuses.map((r) => ({
      status: r.status,
      count: r._count._all,
      premium: money(r._sum.offeredPremium ?? 0),
    })),
    findingsBySeverity: severity.map((s) => ({ severity: s.severity, count: s._count._all })),
    findingsByIssue: issueCodes.map((s) => ({ issueCode: s.issueCode, count: s._count._all })),
    validationRun: validationRun
      ? { id: validationRun.id, ranAt: validationRun.finishedAt, findings: validationRun.findingsCount }
      : null,
    groundTruthLabels: labels,
  };
}
