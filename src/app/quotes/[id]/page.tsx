import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, ArrowRight } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import type { Quote } from "@/types/api";
import { formatCurrency, formatDate, formatDateTime, formatNumber, humanize } from "@/lib/format";
import { DetailHeader, DetailSection, FactGrid } from "@/components/detail/detail-shell";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/states/error-state";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiGet<{ quote: Quote }>(`/api/quotes/${encodeURIComponent(id)}`);

  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) {
    return (
      <ErrorState
        title="Quote could not be loaded"
        description="The quote endpoint did not respond successfully."
        detail={`${result.error} (status ${result.status})`}
      />
    );
  }

  const quote = result.data.quote;
  const breakdown = quote.pricingBreakdown;
  const factors = quote.riskFactors ?? [];
  const coverages = quote.coverages ?? [];
  const referralReasons = Array.isArray(quote.referralReasons) ? quote.referralReasons : [];

  return (
    <div className="space-y-5">
      <DetailHeader
        backHref="/quotes"
        backLabel="Back to quotes"
        eyebrow="Quote"
        title={quote.reference}
        badges={
          <>
            <StatusBadge value={quote.decision} kind="decision" />
            <Badge variant="neutral">{quote.status}</Badge>
          </>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {quote.applicant ? (
              <Link href={`/applicants/${quote.applicant.reference}`} className="text-primary hover:underline">
                {quote.applicant.firstName} {quote.applicant.lastName}
              </Link>
            ) : null}
            <span aria-hidden>·</span>
            <span>{quote.product?.name}</span>
            {quote.asset ? (
              <>
                <span aria-hidden>·</span>
                <Link href={`/assets/${quote.asset.reference}`} className="text-primary hover:underline">
                  {quote.asset.description}
                </Link>
              </>
            ) : null}
          </span>
        }
      />

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Decision</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground">{quote.decisionSummary ?? "No decision summary recorded."}</p>
      </div>

      <DetailSection title="Quote summary" description="Immutable record of what was priced and under which rule versions.">
        <FactGrid
          columns={4}
          facts={[
            { label: "Coverage limit", value: formatCurrency(quote.coverageLimit) },
            { label: "Gross premium", value: formatCurrency(quote.grossPremium) },
            { label: "Net premium", value: formatCurrency(quote.netPremium) },
            { label: "Factor product", value: `×${quote.factorProduct}` },
            { label: "Evaluated", value: formatDateTime(quote.evaluatedAt) },
            { label: "Expires", value: formatDate(quote.expiresAt) },
            { label: "Pricing version", value: quote.pricingVersion, mono: true },
            { label: "Rules version", value: quote.rulesVersion, mono: true },
          ]}
        />
      </DetailSection>

      {referralReasons.length > 0 ? (
        <DetailSection title="Referral reasons" description="Deterministic thresholds that routed this quote to underwriting.">
          <ul className="space-y-2">
            {referralReasons.map((reason) => (
              <li key={reason.code} className="flex gap-3 rounded-lg border border-[#fde68a] bg-warning-soft/60 p-3">
                <AlertCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                <div>
                  <p className="font-mono text-[11px] text-warning">{reason.code}</p>
                  <p className="text-xs leading-relaxed text-foreground">{reason.message}</p>
                </div>
              </li>
            ))}
          </ul>
        </DetailSection>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <DetailSection title="Premium breakdown" description="Every arithmetic step, in evaluation order.">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="text-muted">Exposure base (limit ÷ 1,000 × factor)</TableCell>
                <TableCell className="text-right tabular">{breakdown?.exposureBase ? `${formatNumber(Number(breakdown.exposureBase))} exposure units` : "—"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted">Base rate per 1,000</TableCell>
                <TableCell className="text-right tabular">{breakdown?.baseRate ? `${Number(breakdown.baseRate).toFixed(4)} per 1,000` : "—"}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted">Premium at base rate</TableCell>
                <TableCell className="text-right tabular">{formatCurrency(breakdown?.premiumAtBase ?? "0")}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted">Combined factor product</TableCell>
                <TableCell className="text-right tabular">×{breakdown?.factorProduct ?? quote.factorProduct}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted">Premium after factors</TableCell>
                <TableCell className="text-right tabular">{formatCurrency(breakdown?.premiumAfterFactors ?? "0")}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="text-muted">
                  Minimum premium{breakdown?.minimumPremiumApplied ? " (applied)" : " (not binding)"}
                </TableCell>
                <TableCell className="text-right tabular">{formatCurrency(breakdown?.minimumPremium ?? "0")}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Gross premium</TableCell>
                <TableCell className="text-right font-medium tabular">{formatCurrency(quote.grossPremium)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Rounding: {breakdown?.rounding?.note ?? "HALF_UP to 2 decimals at the final step"}. Computed{" "}
            {breakdown?.computedAt ? formatDateTime(breakdown.computedAt) : "—"}.
          </p>
        </DetailSection>

        <DetailSection title="Applied risk factors" description="Only factors whose condition matched the observed data.">
          {factors.length === 0 ? (
            <p className="text-xs text-muted">No risk factors applied to this quote.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Factor</TableHead>
                  <TableHead>Observed</TableHead>
                  <TableHead className="text-right">Multiplier</TableHead>
                  <TableHead>Referral</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factors.map((factor) => (
                  <TableRow key={factor.id}>
                    <TableCell>
                      <div className="font-medium">{factor.riskFactor?.label ?? "Factor"}</div>
                      <div className="font-mono text-[11px] text-muted">{factor.riskFactor?.code}</div>
                    </TableCell>
                    <TableCell className="text-muted">{factor.observedValue}</TableCell>
                    <TableCell className="text-right tabular">×{factor.multiplier}</TableCell>
                    <TableCell>{factor.referred ? <Badge variant="warning">Referred</Badge> : <span className="text-xs text-muted">—</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DetailSection>
      </div>

      <DetailSection title="Coverage lines" description="Requested versus approved limits per coverage option.">
        {coverages.length === 0 ? (
          <p className="text-xs text-muted">No coverage lines recorded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead>Type</TableHead>
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
                  <TableCell className="font-medium">{line.coverageOption?.name ?? "—"}</TableCell>
                  <TableCell className="text-muted">{humanize(line.coverageOption?.coverageType ?? "")}</TableCell>
                  <TableCell className="text-right tabular">{formatCurrency(line.requestedLimit)}</TableCell>
                  <TableCell className="text-right tabular">{formatCurrency(line.approvedLimit)}</TableCell>
                  <TableCell className="text-right tabular">{line.rateFactor}</TableCell>
                  <TableCell>
                    {line.limitViolation ? <Badge variant="danger">Outside limits</Badge> : <Badge variant="success">Within limits</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DetailSection>

      <div className="grid gap-5 sm:grid-cols-2">
        <DetailSection title="Linked records" description="Navigate to the related applicant, asset or policy.">
          <ul className="divide-y divide-border text-sm">
            {quote.applicant ? (
              <li>
                <Link href={`/applicants/${quote.applicant.reference}`} className="flex items-center justify-between gap-2 py-2 hover:text-primary">
                  <span>
                    <span className="block text-[11px] uppercase tracking-wide text-muted">Applicant</span>
                    {quote.applicant.firstName} {quote.applicant.lastName}
                  </span>
                  <ArrowRight aria-hidden className="size-4 text-muted" />
                </Link>
              </li>
            ) : null}
            {quote.asset ? (
              <li>
                <Link href={`/assets/${quote.asset.reference}`} className="flex items-center justify-between gap-2 py-2 hover:text-primary">
                  <span>
                    <span className="block text-[11px] uppercase tracking-wide text-muted">Insured asset</span>
                    {quote.asset.description}
                  </span>
                  <ArrowRight aria-hidden className="size-4 text-muted" />
                </Link>
              </li>
            ) : null}
            {quote.policy ? (
              <li>
                <Link href={`/policies/${quote.policy.reference}`} className="flex items-center justify-between gap-2 py-2 hover:text-primary">
                  <span>
                    <span className="block text-[11px] uppercase tracking-wide text-muted">Issued policy</span>
                    {quote.policy.reference} · {humanize(quote.policy.status)}
                  </span>
                  <ArrowRight aria-hidden className="size-4 text-muted" />
                </Link>
              </li>
            ) : (
              <li className="py-2 text-xs text-muted">No policy issued from this quote.</li>
            )}
          </ul>
        </DetailSection>

        <DetailSection title="Underwriting" description="Reviewer involvement for referred quotes.">
          {quote.underwriting && quote.underwriting.length > 0 ? (
            <ul className="space-y-2">
              {quote.underwriting.map((decision) => (
                <li key={decision.reference} className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-muted/60 px-3 py-2">
                  <span className="font-mono text-xs">{decision.reference}</span>
                  <StatusBadge value={decision.status} kind="underwriting" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">No underwriting case was opened for this quote.</p>
          )}
        </DetailSection>
      </div>
    </div>
  );
}
