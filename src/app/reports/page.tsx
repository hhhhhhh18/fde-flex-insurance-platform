import { BadgeAlert, Banknote, FileText, ShieldCheck, RefreshCw, ClipboardCheck } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import type { DashboardSummaryResponse, ReportSummaryResponse } from "@/types/api";
import { formatCurrency, formatDateTime, formatNumber, humanize } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { ExportLinks } from "@/components/reports/export-links";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

export const metadata = { title: "Reports" };

export default async function ReportsPage() {
  const [reportResult, dashboardResult] = await Promise.all([
    apiGet<ReportSummaryResponse>("/api/reports/summary"),
    apiGet<DashboardSummaryResponse>("/api/dashboard/summary"),
  ]);

  if (!reportResult.ok) {
    return (
      <div className="space-y-5">
        <PageHeader eyebrow="Operations" title="Reports" description="Portfolio metrics, validation results and exports." />
        <ErrorState
          title="Reports could not be loaded"
          description="The reporting endpoint did not respond successfully."
          detail={`${reportResult.error} (status ${reportResult.status})`}
          action={<RefreshButton />}
        />
      </div>
    );
  }

  const report = reportResult.data;
  const dashboard = dashboardResult.ok ? dashboardResult.data : null;
  const totalQuoted = report.quotes.reduce((sum, row) => sum + Number(row.premium), 0);
  const totalIssued = report.policies.reduce((sum, row) => sum + Number(row.premium), 0);
  const totalQuotes = report.quotes.reduce((sum, row) => sum + row.count, 0);
  const totalPolicies = report.policies.reduce((sum, row) => sum + row.count, 0);
  const findings = report.validationRun?.findings ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Reports"
        description="Portfolio performance, exception summary and reproducible exports. Figures are computed from the operational database."
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline">Dataset: {report.dataset}</Badge>
            <RefreshButton />
          </div>
        }
      />

      {totalQuotes === 0 && totalPolicies === 0 ? (
        <EmptyState
          title="No data to report"
          description="Generate the synthetic portfolio before running reports."
          action={<code className="rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-xs">npm run db:seed</code>}
        />
      ) : null}

      <section aria-label="Report totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Quoted premium"
          value={formatCurrency(totalQuoted)}
          hint={`${formatNumber(totalQuotes)} quotes evaluated`}
          icon={Banknote}
          tone="info"
          footer="Gross premium across all quotes"
        />
        <KpiCard
          label="Issued premium"
          value={formatCurrency(totalIssued)}
          hint={`${formatNumber(totalPolicies)} policies`}
          icon={ShieldCheck}
          tone="success"
          footer="Excludes cancelled policies"
        />
        <KpiCard
          label="Findings"
          value={formatNumber(findings)}
          hint={report.validationRun ? `Run ${formatDateTime(report.validationRun.ranAt)}` : "No validation run"}
          icon={BadgeAlert}
          tone={findings > 0 ? "danger" : "neutral"}
          footer={`${formatNumber(report.groundTruthLabels)} ground-truth labels`}
        />
        <KpiCard
          label="Reproducibility"
          value={
            dashboard?.reproducibility.status === "MATCH"
              ? "Match"
              : dashboard?.reproducibility.status === "MISMATCH"
                ? "Mismatch"
                : "Not run"
          }
          hint={dashboard?.reproducibility.checkedAt ? formatDateTime(dashboard.reproducibility.checkedAt) : "Compare two exports"}
          icon={RefreshCw}
          tone={dashboard?.reproducibility.status === "MISMATCH" ? "danger" : dashboard?.reproducibility.status === "MATCH" ? "success" : "neutral"}
          footer="Deterministic checksum comparison"
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Quote decisions</CardTitle>
            <CardDescription>Counts and gross premium by decision.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Decision</TableHead>
                  <TableHead className="text-right">Quotes</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.quotes.map((row) => (
                  <TableRow key={row.decision}>
                    <TableCell>
                      <StatusBadge value={row.decision} kind="decision" />
                    </TableCell>
                    <TableCell className="text-right tabular">{formatNumber(row.count)}</TableCell>
                    <TableCell className="text-right tabular">{formatCurrency(row.premium)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Policies by status</CardTitle>
            <CardDescription>In-force, pending and terminated cover.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Policies</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.policies.map((row) => (
                  <TableRow key={row.status}>
                    <TableCell>
                      <StatusBadge value={row.status} kind="policy" />
                    </TableCell>
                    <TableCell className="text-right tabular">{formatNumber(row.count)}</TableCell>
                    <TableCell className="text-right tabular">{formatCurrency(row.premium)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 overflow-hidden">
          <CardHeader>
            <CardTitle>Findings by issue type</CardTitle>
            <CardDescription>Latest validation run, ordered by frequency.</CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {report.findingsByIssue.length === 0 ? (
              <p className="px-5 pb-5 text-xs text-muted">No findings recorded in the latest validation run.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Issue code</TableHead>
                    <TableHead className="text-right">Findings</TableHead>
                    <TableHead className="hidden sm:table-cell text-right">Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.findingsByIssue.map((row) => (
                    <TableRow key={row.issueCode}>
                      <TableCell className="font-mono text-xs">{row.issueCode}</TableCell>
                      <TableCell className="text-right tabular">{formatNumber(row.count)}</TableCell>
                      <TableCell className="hidden sm:table-cell text-right tabular text-muted">
                        {findings > 0 ? `${Math.round((row.count / findings) * 100)}%` : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data quality</CardTitle>
            <CardDescription>Validation and reproducibility state.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Validation</span>
              <Badge
                variant={
                  report.validationRun ? (findings > 0 ? "danger" : "success") : "neutral"
                }
              >
                {report.validationRun ? (findings > 0 ? "Findings raised" : "Passed") : "Not run"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Checks</span>
              <span className="tabular">12 rule families</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Ground-truth labels</span>
              <span className="tabular">{formatNumber(report.groundTruthLabels)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Reproducibility</span>
              <Badge
                variant={
                  dashboard?.reproducibility.status === "MATCH"
                    ? "success"
                    : dashboard?.reproducibility.status === "MISMATCH"
                      ? "danger"
                      : "neutral"
                }
              >
                {dashboard?.reproducibility.status ? humanize(dashboard.reproducibility.status) : "Not run"}
              </Badge>
            </div>
            {dashboard?.reproducibility.detail ? (
              <p className="border-t border-border pt-2 text-[11px] leading-relaxed text-muted">
                {dashboard.reproducibility.detail}
              </p>
            ) : (
              <p className="border-t border-border pt-2 text-[11px] leading-relaxed text-muted">
                Run <span className="font-mono">npm run data:compare</span> against two exports to publish a checksum
                comparison.
              </p>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
              <span className="text-muted">Underwriting queue</span>
              <span className="tabular">{formatNumber(dashboard?.underwriting.pending ?? 0)} open</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">Generated</span>
              <span className="text-[11px] text-muted">{formatDateTime(report.generatedAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Exports</CardTitle>
              <CardDescription>
                Downloads are generated on request from the current database using the deterministic export projection.
              </CardDescription>
            </div>
            <Badge variant="neutral">
              <ClipboardCheck aria-hidden className="size-3" />
              Reference-keyed
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ExportLinks />
        </CardContent>
      </Card>

      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <FileText aria-hidden className="size-3.5" />
        Premium totals are summed from stored NUMERIC values; no client-side arithmetic beyond display formatting.
      </p>
    </div>
  );
}
