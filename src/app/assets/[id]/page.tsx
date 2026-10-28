import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import type { Applicant, Asset, Policy, Quote } from "@/types/api";
import { formatCurrency, formatDate, formatNumber, humanize } from "@/lib/format";
import { DetailHeader, DetailSection, FactGrid } from "@/components/detail/detail-shell";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/states/error-state";

interface AssetDetail extends Asset {
  applicant: Applicant;
  quotes: Quote[];
  policies: Policy[];
}

export default async function AssetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiGet<AssetDetail>(`/api/assets/${encodeURIComponent(id)}`);

  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) {
    return (
      <ErrorState
        title="Asset could not be loaded"
        description="The asset endpoint did not respond successfully."
        detail={`${result.error} (status ${result.status})`}
      />
    );
  }

  const asset = result.data;

  return (
    <div className="space-y-5">
      <DetailHeader
        backHref="/assets"
        backLabel="Back to insured assets"
        eyebrow="Insured asset"
        title={asset.reference}
        badges={
          <>
            <Badge variant="neutral">{humanize(asset.usage)}</Badge>
            <Badge variant="outline">{humanize(asset.condition)}</Badge>
          </>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-foreground">{asset.description}</span>
            <span aria-hidden>·</span>
            <span>{humanize(asset.assetType)}</span>
            <span aria-hidden>·</span>
            <span>{asset.region}</span>
          </span>
        }
      />

      {!asset.riskDataComplete ? (
        <div className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[#fde68a] bg-warning-soft px-4 py-3 text-xs text-warning">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Risk information is incomplete</p>
            <p className="mt-0.5">
              Missing field: {asset.missingRiskField ?? "unspecified"}. Quotes against this asset are held for
              additional information rather than priced to completion.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <DetailSection
          title="Asset attributes"
          description="Declared characteristics used by the rating engine."
          className="lg:col-span-2"
        >
          <FactGrid
            columns={3}
            facts={[
              { label: "Reference", value: asset.reference, mono: true },
              { label: "Type", value: humanize(asset.assetType) },
              { label: "Region", value: asset.region },
              { label: "Year built", value: String(asset.yearBuilt) },
              { label: "Purchase value", value: formatCurrency(asset.purchaseValue) },
              { label: "Current value", value: formatCurrency(asset.currentValue) },
              { label: "Condition", value: humanize(asset.condition) },
              { label: "Usage", value: humanize(asset.usage) },
              { label: "Claims (5 years)", value: formatNumber(asset.claimsHistory5y) },
              {
                label: "Risk data",
                value: asset.riskDataComplete ? "Complete" : `Incomplete (${asset.missingRiskField ?? "unknown"})`,
              },
            ]}
          />
        </DetailSection>

        <DetailSection title="Owner" description="Applicant on record.">
          <div className="space-y-4">
            <div>
              <Link
                href={`/applicants/${asset.applicant.reference}`}
                className="text-sm font-medium hover:underline"
              >
                {asset.applicant.firstName} {asset.applicant.lastName}
              </Link>
              <p className="font-mono text-[11px] text-muted">{asset.applicant.reference}</p>
            </div>
            <FactGrid
              columns={2}
              facts={[
                { label: "Email", value: asset.applicant.email },
                { label: "Region", value: asset.applicant.region },
                { label: "Credit band", value: asset.applicant.creditBand },
                { label: "Date of birth", value: formatDate(asset.applicant.dateOfBirth) },
              ]}
            />
          </div>
        </DetailSection>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <DetailSection title="Quotes" description="Evaluations against this asset.">
          {asset.quotes.length === 0 ? (
            <p className="text-xs text-muted">No quotes recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead className="hidden sm:table-cell">Product</TableHead>
                  <TableHead>Decision</TableHead>
                  <TableHead className="text-right">Gross premium</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asset.quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/quotes/${quote.id}`} className="text-primary hover:underline">
                        {quote.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted">{quote.product?.name ?? "—"}</TableCell>
                    <TableCell>
                      <StatusBadge value={quote.decision} kind="decision" />
                    </TableCell>
                    <TableCell className="text-right tabular">{formatCurrency(quote.grossPremium)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DetailSection>

        <DetailSection title="Policies" description="Cover attached to this asset.">
          {asset.policies.length === 0 ? (
            <p className="text-xs text-muted">No policies issued for this asset.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead className="hidden sm:table-cell">Term</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asset.policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/policies/${policy.id}`} className="text-primary hover:underline">
                        {policy.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted">
                      {formatDate(policy.effectiveFrom)} → {formatDate(policy.effectiveTo)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={policy.status} kind="policy" />
                    </TableCell>
                    <TableCell className="text-right tabular">{formatCurrency(policy.premium)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DetailSection>
      </div>
    </div>
  );
}
