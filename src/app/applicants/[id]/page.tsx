import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api-client/server";
import type { Applicant, Asset, Policy, Quote } from "@/types/api";
import { formatCurrency, formatDate, humanize } from "@/lib/format";
import { DetailHeader, DetailSection, FactGrid } from "@/components/detail/detail-shell";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/states/error-state";

interface ApplicantDetail extends Applicant {
  assets: Asset[];
  quotes: Quote[];
  policies: Policy[];
}

export default async function ApplicantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiGet<ApplicantDetail>(`/api/applicants/${encodeURIComponent(id)}`);

  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) {
    return (
      <ErrorState
        title="Applicant could not be loaded"
        description="The applicant endpoint did not respond successfully."
        detail={`${result.error} (status ${result.status})`}
      />
    );
  }

  const applicant = result.data;
  const quotedTotal = applicant.quotes.reduce((sum, quote) => sum + Number(quote.grossPremium), 0);
  const issuedTotal = applicant.policies.reduce((sum, policy) => sum + Number(policy.premium), 0);

  return (
    <div className="space-y-5">
      <DetailHeader
        backHref="/applicants"
        backLabel="Back to applicants"
        eyebrow="Applicant"
        title={applicant.reference}
        badges={<Badge variant="neutral">Credit band {applicant.creditBand}</Badge>}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-foreground">
              {applicant.firstName} {applicant.lastName}
            </span>
            <span aria-hidden>·</span>
            <span>{applicant.occupation}</span>
            <span aria-hidden>·</span>
            <span>
              {applicant.region}, {applicant.country}
            </span>
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <DetailSection
          title="Profile"
          description="Applicant attributes used by eligibility and rating."
          className="lg:col-span-2"
        >
          <FactGrid
            columns={3}
            facts={[
              { label: "Email", value: applicant.email },
              { label: "Phone", value: applicant.phone ?? "—" },
              { label: "Date of birth", value: formatDate(applicant.dateOfBirth) },
              { label: "Country", value: applicant.country },
              { label: "Region", value: applicant.region },
              { label: "Occupation", value: applicant.occupation },
              { label: "Occupation class", value: String(applicant.occupationClass) },
              { label: "Annual income", value: formatCurrency(applicant.annualIncome) },
              { label: "Credit band", value: applicant.creditBand },
            ]}
          />
        </DetailSection>

        <DetailSection title="Portfolio" description="Linked records and premium totals.">
          <FactGrid
            columns={2}
            facts={[
              { label: "Insured assets", value: String(applicant.assets.length) },
              { label: "Quotes", value: String(applicant.quotes.length) },
              { label: "Policies", value: String(applicant.policies.length) },
              { label: "Quoted premium", value: formatCurrency(quotedTotal) },
              { label: "Issued premium", value: formatCurrency(issuedTotal) },
            ]}
          />
        </DetailSection>
      </div>

      <DetailSection title="Insured assets" description="Assets belonging to this applicant.">
        {applicant.assets.length === 0 ? (
          <p className="text-xs text-muted">No insured assets recorded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="text-right">Current value</TableHead>
                <TableHead className="hidden md:table-cell">Condition</TableHead>
                <TableHead>Risk data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {applicant.assets.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/assets/${asset.id}`} className="text-primary hover:underline">
                      {asset.reference}
                    </Link>
                  </TableCell>
                  <TableCell>{asset.description}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted">{humanize(asset.assetType)}</TableCell>
                  <TableCell className="text-right tabular">{formatCurrency(asset.currentValue)}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted">{humanize(asset.condition)}</TableCell>
                  <TableCell>
                    {asset.riskDataComplete ? (
                      <Badge variant="success">Complete</Badge>
                    ) : (
                      <Badge variant="warning">Missing {asset.missingRiskField ?? "fields"}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DetailSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <DetailSection title="Quotes" description="Most recent evaluations.">
          {applicant.quotes.length === 0 ? (
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
                {applicant.quotes.map((quote) => (
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

        <DetailSection title="Policies" description="Issued cover for this applicant.">
          {applicant.policies.length === 0 ? (
            <p className="text-xs text-muted">No policies issued.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead className="hidden sm:table-cell">Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {applicant.policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="font-mono text-xs">
                      <Link href={`/policies/${policy.id}`} className="text-primary hover:underline">
                        {policy.reference}
                      </Link>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted">{policy.product?.name ?? "—"}</TableCell>
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
