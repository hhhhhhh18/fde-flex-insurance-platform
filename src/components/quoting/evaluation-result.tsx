import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { EvaluateResponse } from "@/types/quoting";
import { formatCurrency, formatDate, humanize } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/** Renders a completed evaluation. Presentational only - no data fetching. */
export function EvaluationResult({ result }: { result: EvaluateResponse }) {
  const { quote, explanation } = result;
  const breakdown = explanation.breakdown ?? quote.pricingBreakdown;
  const coverages = quote.coverages ?? [];
  const factors = breakdown?.factors ?? [];

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border bg-surface-muted/60 px-5 py-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Evaluation result</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Link href={`/quotes/${quote.id}`} className="font-mono text-lg font-semibold hover:underline">
              {quote.reference}
            </Link>
            <StatusBadge value={quote.decision} kind="decision" />
            <Badge variant="neutral">{humanize(quote.status)}</Badge>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted">{explanation.summary}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted">Gross premium</p>
          <p className="text-2xl font-semibold tabular">{formatCurrency(quote.grossPremium)}</p>
          <p className="text-[11px] text-muted">Expires {formatDate(quote.expiresAt)}</p>
        </div>
      </div>

      <div className="grid gap-6 px-5 py-5 lg:grid-cols-2">
        <section aria-labelledby="breakdown-heading">
          <h3 id="breakdown-heading" className="text-sm font-semibold">
            Premium breakdown
          </h3>
          <dl className="mt-3 space-y-2 text-xs">
            {[
              ["Exposure base", `${Number(breakdown.exposureBase).toFixed(2)} units`],
              ["Base rate per 1,000", Number(breakdown.baseRate).toFixed(4)],
              ["Premium at base", formatCurrency(breakdown.premiumAtBase)],
              ["Combined factor", `× ${Number(breakdown.factorProduct).toFixed(6)}`],
              ["Premium after factors", formatCurrency(breakdown.premiumAfterFactors)],
              [
                "Minimum premium",
                `${formatCurrency(breakdown.minimumPremium)}${breakdown.minimumPremiumApplied ? " (applied)" : " (not binding)"}`,
              ],
              ["Net premium", formatCurrency(breakdown.netPremium)],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-border/70 pb-1.5">
                <dt className="text-muted">{label}</dt>
                <dd className="font-medium tabular">{value}</dd>
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 pt-1">
              <dt className="font-medium">Gross premium</dt>
              <dd className="text-sm font-semibold tabular">{formatCurrency(breakdown.grossPremium)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-[10px] leading-relaxed text-muted">{breakdown.rounding?.note}</p>
        </section>

        <section aria-labelledby="factors-heading">
          <h3 id="factors-heading" className="text-sm font-semibold">
            Applied rating factors
          </h3>
          {factors.length === 0 ? (
            <p className="mt-3 text-xs text-muted">No rating factors matched this risk.</p>
          ) : (
            <Table className="mt-2">
              <TableHeader>
                <TableRow>
                  <TableHead className="px-2">Factor</TableHead>
                  <TableHead className="px-2">Observed</TableHead>
                  <TableHead className="px-2 text-right">Multiplier</TableHead>
                  <TableHead className="px-2">Referral</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factors.map((factor) => (
                  <TableRow key={factor.code}>
                    <TableCell className="px-2">
                      <p className="font-medium">{factor.label}</p>
                      <p className="font-mono text-[10px] text-muted">{factor.code}</p>
                    </TableCell>
                    <TableCell className="px-2 text-muted">{factor.observed}</TableCell>
                    <TableCell className="px-2 text-right tabular">× {Number(factor.multiplier).toFixed(3)}</TableCell>
                    <TableCell className="px-2">
                      {factor.triggersReferral ? <Badge variant="warning">Refers</Badge> : <span className="text-muted">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      {explanation.referrals.length > 0 ? (
        <div className="border-t border-border bg-warning-soft/40 px-5 py-4">
          <h3 className="text-sm font-semibold text-warning">Referral reasons</h3>
          <ul className="mt-2 space-y-2">
            {explanation.referrals.map((referral) => (
              <li key={referral.code} className="flex flex-wrap items-start gap-2 text-xs">
                <Badge variant="warning" className="font-mono">
                  {referral.code}
                </Badge>
                <span className="flex-1 text-foreground/80">{referral.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="border-t border-border px-5 py-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Coverage lines</h3>
          <Badge variant="neutral">{coverages.length} options</Badge>
        </div>
        <Table className="mt-2">
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Coverage</TableHead>
              <TableHead className="text-right">Requested</TableHead>
              <TableHead className="text-right">Approved</TableHead>
              <TableHead className="text-right">Rate factor</TableHead>
              <TableHead>Limit check</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {coverages.map((line) => (
              <TableRow key={line.id}>
                <TableCell className="font-mono text-xs">{line.coverageOption?.code ?? "—"}</TableCell>
                <TableCell>{line.coverageOption?.name ?? "—"}</TableCell>
                <TableCell className="text-right tabular">{formatCurrency(line.requestedLimit)}</TableCell>
                <TableCell className="text-right tabular">{formatCurrency(line.approvedLimit)}</TableCell>
                <TableCell className="text-right tabular">{Number(line.rateFactor).toFixed(3)}</TableCell>
                <TableCell>
                  {line.limitViolation ? <Badge variant="danger">Outside limits</Badge> : <Badge variant="success">Within limits</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="border-t border-border px-5 py-3">
        <Link
          href={`/quotes/${quote.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          Open full quote record
          <ArrowRight aria-hidden className="size-3.5" />
        </Link>
      </div>
    </Card>
  );
}
