import {
  Banknote,
  BadgeAlert,
  Building2,
  FileText,
  RefreshCw,
  ShieldCheck,
  ClipboardCheck,
  CircleDollarSign,
} from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import type { DashboardSummaryResponse, ReportSummaryResponse } from "@/types/api";
import { formatCurrency, formatDateTime, formatNumber, humanize } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DecisionMixChart } from "@/components/charts/decision-mix-chart";
import { PolicyStatusChart } from "@/components/charts/policy-status-chart";
import { PremiumTrendChart } from "@/components/charts/premium-trend-chart";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

export const metadata = {
  title: "Operations overview",
};

const countFor = (rows: { count: number }[] | undefined, key: string, field: string) => {
  const match = (rows ?? []).find((row) => (row as Record<string, unknown>)[field] === key);
  return match?.count ?? 0;
};

export default async function DashboardPage() {
  const [dashboardResult, reportResult] = await Promise.all([
    apiGet<DashboardSummaryResponse>("/api/dashboard/summary"),
    apiGet<ReportSummaryResponse>("/api/reports/summary"),
  ]);

  if (!dashboardResult.ok) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Operations"
          title="Portfolio overview"
          description="Live operational metrics derived from the insurance database."
        />
        <ErrorState
          title="Dashboard data is unavailable"
          description="The dashboard summary endpoint did not return data. The backend may be starting up or the database may be unreachable."
          detail={`${dashboardResult.error} (status ${dashboardResult.status})`}
          action={<RefreshButton />}
        />
      </div>
    );
  }

  const data = dashboardResult.data;
  const report = reportResult.ok ? reportResult.data : null;

  const eligible = countFor(data.quotesByDecision, "ELIGIBLE", "decision");
  const referred = countFor(data.quotesByDecision, "REFERRED", "decision");
  const awaiting = countFor(data.quotesByDecision, "AWAITING_INFORMATION", "decision");
  const ineligible = countFor(data.quotesByDecision, "INELIGIBLE", "decision");

  const activePolicies = countFor(data.policiesByStatus, "ACTIVE", "status");
  const cancelledPolicies = countFor(data.policiesByStatus, "CANCELLED", "status");
  const pendingPolicies = countFor(data.policiesByStatus, "PENDING_PAYMENT", "status");
  const expiredPolicies = countFor(data.policiesByStatus, "EXPIRED", "status");

  const offeredRenewals = countFor(data.renewalsByStatus, "OFFERED", "status");
  const acceptedRenewals = countFor(data.renewalsByStatus, "ACCEPTED", "status");

  const hasData = data.counts.quotes > 0 || data.counts.policies > 0;
  const exceptionTotal = report?.validationRun?.findings ?? data.exceptions.total;
  const validationStatus = data.validation.status;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations"
        title="Portfolio overview"
        description="Every figure on this page is computed from the operational database — quotes rated by the pricing engine, policies in force, referrals awaiting a decision, and validation findings."
        actions={
          <>
            <Badge variant="outline" className="hidden sm:inline-flex">
              Synthetic book · {formatNumber(data.counts.applicants)} applicants
            </Badge>
            <span className="hidden text-[11px] text-muted md:inline">
              Updated {formatDateTime(data.generatedAt)} UTC
            </span>
            <RefreshButton />
          </>
        }
      />

      {!hasData ? (
        <EmptyState
          title="No operational data yet"
          description="The database is connected but contains no quotes or policies. Generate the synthetic portfolio, then refresh this page."
          action={
            <code className="rounded-md border border-border bg-surface-muted px-3 py-2 font-mono text-xs text-foreground">
              npm run db:seed
            </code>
          }
        />
      ) : null}

      {validationStatus === "NOT_RUN" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#bae6fd] bg-info-soft px-4 py-3 text-xs text-info">
          <BadgeAlert aria-hidden className="size-4" />
          <span className="font-medium">No data-quality run recorded.</span>
          <span className="text-info/80">
            Exception counts are unavailable until the validator runs.
          </span>
          <code className="ml-auto rounded border border-[#bae6fd] bg-surface px-2 py-1 font-mono text-[11px]">npm run data:validate</code>
        </div>
      ) : null}

      {/* KPI row */}
      <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Quotes"
          value={formatNumber(data.counts.quotes)}
          hint={`${formatNumber(eligible)} eligible · ${formatNumber(referred)} referred`}
          icon={FileText}
          tone="primary"
          footer={`${formatNumber(awaiting)} awaiting information · ${formatNumber(ineligible)} ineligible`}
        />
        <KpiCard
          label="Policies"
          value={formatNumber(data.counts.policies)}
          hint={`${formatNumber(activePolicies)} active · ${formatNumber(cancelledPolicies)} cancelled`}
          icon={ShieldCheck}
          tone="success"
          footer={`${formatNumber(pendingPolicies)} pending payment · ${formatNumber(expiredPolicies)} expired`}
        />
        <KpiCard
          label="Quoted premium"
          value={formatCurrency(data.premiums.quotedTotal)}
          hint={`Average ${formatCurrency(data.premiums.averageQuoted)} per quote`}
          icon={Banknote}
          tone="info"
          footer="Gross premium across all evaluated quotes"
        />
        <KpiCard
          label="Issued premium"
          value={formatCurrency(data.premiums.issuedTotal)}
          hint="Excludes cancelled policies"
          icon={CircleDollarSign}
          tone="success"
          footer={
            Number(data.premiums.quotedTotal) > 0
              ? `${Math.round((Number(data.premiums.issuedTotal) / Number(data.premiums.quotedTotal)) * 100)}% of quoted premium bound`
              : "No quoted premium yet"
          }
        />
        <KpiCard
          label="Underwriting referrals"
          value={formatNumber(data.underwriting.pending)}
          hint={`${formatNumber(data.underwriting.approved)} approved · ${formatNumber(data.underwriting.declined)} declined`}
          icon={ClipboardCheck}
          tone={data.underwriting.pending > 0 ? "warning" : "neutral"}
          footer="Open cases requiring a reviewer decision"
        />
        <KpiCard
          label="Renewals"
          value={formatNumber(data.counts.renewals)}
          hint={`${formatNumber(offeredRenewals)} open ${offeredRenewals === 1 ? "offer" : "offers"} · ${formatNumber(acceptedRenewals)} accepted`}
          icon={RefreshCw}
          tone="primary"
          footer="Open offers require a customer response before expiry"
        />
        <KpiCard
          label="Exceptions"
          value={formatNumber(exceptionTotal)}
          hint={
            report?.validationRun
              ? `Latest run ${formatDateTime(report.validationRun.ranAt)}`
              : "No validation run recorded"
          }
          icon={BadgeAlert}
          tone={exceptionTotal > 0 ? "danger" : "neutral"}
          footer={
            data.exceptions.bySeverity && Object.keys(data.exceptions.bySeverity).length > 0
              ? Object.entries(data.exceptions.bySeverity)
                  .map(([severity, count]) => `${count} ${severity.toLowerCase()}`)
                  .join(" · ")
              : "Run the validator to populate findings"
          }
        />
        <KpiCard
          label="Insured assets"
          value={formatNumber(data.counts.assets)}
          hint={`${formatNumber(data.counts.products)} products · ${formatNumber(data.counts.endorsements)} endorsements`}
          icon={Building2}
          tone="neutral"
          footer={`${formatNumber(data.counts.renewals)} renewal${data.counts.renewals === 1 ? "" : "s"} tracked`}
        />
      </section>

      {/* Charts */}
      <section aria-label="Operational charts" className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Quote decisions</CardTitle>
            <CardDescription>Distribution of evaluated quotes by outcome.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.quotesByDecision.length > 0 ? (
              <DecisionMixChart data={data.quotesByDecision} />
            ) : (
              <p className="py-10 text-center text-xs text-muted">No quotes evaluated yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-1">
          <CardHeader>
            <CardTitle>Policy status</CardTitle>
            <CardDescription>In-force versus cancelled and expired cover.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.policiesByStatus.length > 0 ? (
              <PolicyStatusChart data={data.policiesByStatus} />
            ) : (
              <p className="py-10 text-center text-xs text-muted">No policies issued yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Premium trend</CardTitle>
            <CardDescription>
              Quoted premium by evaluation month and issued premium by policy start month (last six months).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PremiumTrendChart
              data={data.monthlyPremium.map((row) => ({
                month: row.month,
                quoted: Number(row.quoted),
                issued: Number(row.issued),
              }))}
            />
            <div className="mt-2 flex items-center gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-[#1d4ed8]" /> Quoted
              </span>
              <span className="flex items-center gap-1.5">
                <span aria-hidden className="size-2 rounded-full bg-[#0f766e]" /> Issued
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Detail row */}
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Recently evaluated quotes</CardTitle>
              <CardDescription>The eight most recent pricing decisions.</CardDescription>
            </div>
            <Badge variant="neutral">{formatNumber(data.counts.quotes)} total</Badge>
          </CardHeader>
          <CardContent className="px-0 pb-0 pt-2">
            {data.recentQuotes.length === 0 ? (
              <p className="px-5 pb-6 pt-4 text-xs text-muted">No quotes have been evaluated.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Applicant</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead className="text-right">Gross premium</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentQuotes.map((quote) => (
                    <TableRow key={quote.reference}>
                      <TableCell className="font-mono text-xs">{quote.reference}</TableCell>
                      <TableCell>{quote.applicant}</TableCell>
                      <TableCell className="text-muted">{quote.product}</TableCell>
                      <TableCell>
                        <StatusBadge value={quote.decision} kind="decision" />
                      </TableCell>
                      <TableCell className="text-right tabular">{formatCurrency(quote.grossPremium)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data integrity</CardTitle>
            <CardDescription>Validation and reproducibility signals for the current dataset.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">Validation</span>
              <Badge
                variant={
                  validationStatus === "PASS" ? "success" : validationStatus === "FAIL" ? "danger" : "neutral"
                }
              >
                {validationStatus === "NOT_RUN"
                  ? "Not run"
                  : validationStatus === "PASS"
                    ? "Passed"
                    : "Findings raised"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">Findings</span>
              <span className="text-sm font-medium tabular">{formatNumber(exceptionTotal)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">Ground-truth labels</span>
              <span className="text-sm font-medium tabular">{formatNumber(report?.groundTruthLabels ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">Reproducibility</span>
              <Badge
                variant={
                  data.reproducibility.status === "MATCH"
                    ? "success"
                    : data.reproducibility.status === "MISMATCH"
                      ? "danger"
                      : "neutral"
                }
              >
                {data.reproducibility.status === "NOT_RUN" ? "Not run" : humanize(data.reproducibility.status)}
              </Badge>
            </div>

            {report?.findingsBySeverity && report.findingsBySeverity.length > 0 ? (
              <div className="border-t border-border pt-3">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">By severity</p>
                <ul className="space-y-1.5">
                  {report.findingsBySeverity.map((row) => (
                    <li key={row.severity} className="flex items-center justify-between text-xs">
                      <StatusBadge value={row.severity} kind="severity" />
                      <span className="tabular text-foreground">{row.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="border-t border-border pt-3 text-[11px] leading-relaxed text-muted">
                {validationStatus === "NOT_RUN"
                  ? "Run `npm run data:validate` to score the dataset against its ground truth."
                  : "No findings recorded in the latest validation run."}
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
