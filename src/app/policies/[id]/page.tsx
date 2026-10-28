import Link from "next/link";
import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api-client/server";
import type { Endorsement, Policy, Quote, Renewal } from "@/types/api";
import { formatCurrency, formatDate, formatDateTime, humanize } from "@/lib/format";
import { DetailHeader, DetailSection, FactGrid } from "@/components/detail/detail-shell";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/states/error-state";

interface PolicyDetail extends Policy {
  quote?: Quote;
  endorsements: Endorsement[];
  renewals: Renewal[];
}

export default async function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiGet<{ policy: PolicyDetail }>(`/api/policies/${encodeURIComponent(id)}`);

  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) {
    return (
      <ErrorState
        title="Policy could not be loaded"
        description="The policy endpoint did not respond successfully."
        detail={`${result.error} (status ${result.status})`}
      />
    );
  }

  const policy = result.data.policy;
  const endorsements = policy.endorsements ?? [];
  const renewals = policy.renewals ?? [];
  const appliedDelta = endorsements
    .filter((item) => item.status === "APPLIED")
    .reduce((sum, item) => sum + Number(item.premiumDelta || 0), 0);

  return (
    <div className="space-y-5">
      <DetailHeader
        backHref="/policies"
        backLabel="Back to policies"
        eyebrow="Policy"
        title={policy.reference}
        badges={
          <>
            <StatusBadge value={policy.status} kind="policy" />
            <Badge variant={policy.paymentStatus === "PAID" ? "success" : "warning"}>{humanize(policy.paymentStatus)}</Badge>
          </>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {policy.applicant ? (
              <Link href={`/applicants/${policy.applicant.reference}`} className="text-primary hover:underline">
                {policy.applicant.firstName} {policy.applicant.lastName}
              </Link>
            ) : null}
            <span aria-hidden>·</span>
            <span>{policy.product?.name}</span>
            {policy.asset ? (
              <>
                <span aria-hidden>·</span>
                <Link href={`/assets/${policy.asset.reference}`} className="text-primary hover:underline">
                  {policy.asset.description}
                </Link>
              </>
            ) : null}
          </span>
        }
      />

      <DetailSection title="Policy terms" description="Binding terms recorded at issuance.">
        <FactGrid
          columns={4}
          facts={[
            { label: "Effective from", value: formatDate(policy.effectiveFrom) },
            { label: "Effective to", value: formatDate(policy.effectiveTo) },
            { label: "Premium", value: formatCurrency(policy.premium) },
            { label: "Coverage limit", value: formatCurrency(policy.coverageLimit) },
            { label: "Issued at", value: formatDateTime(policy.issuedAt) },
            { label: "Issued by", value: `${humanize(policy.issuedByRole)} · ${policy.issuedBy}` },
            { label: "Payment status", value: humanize(policy.paymentStatus) },
            { label: "Version", value: String(policy.version) },
          ]}
        />
        {policy.status === "CANCELLED" ? (
          <div className="mt-4 rounded-lg border border-[#fecaca] bg-danger-soft/60 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-danger">Cancellation</p>
            <p className="mt-1 text-xs text-foreground">{policy.cancellationReason ?? "No reason recorded."}</p>
            <p className="mt-1 text-[11px] text-muted">Cancelled {formatDateTime(policy.cancelledAt)}</p>
          </div>
        ) : null}
        {appliedDelta !== 0 ? (
          <p className="mt-4 border-t border-border pt-3 text-[11px] text-muted">
            Premium includes <span className="font-medium text-foreground">{formatCurrency(appliedDelta)}</span> of applied endorsement
            adjustments.
          </p>
        ) : null}
      </DetailSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <DetailSection
          title="Originating quote"
          description="The priced decision this policy was bound from."
          action={
            policy.quote ? (
              <Link href={`/quotes/${policy.quote.reference}`} className="text-xs font-medium text-primary hover:underline">
                Open quote
              </Link>
            ) : null
          }
        >
          {policy.quote ? (
            <FactGrid
              columns={2}
              facts={[
                { label: "Quote", value: policy.quote.reference, mono: true },
                { label: "Decision", value: <StatusBadge value={policy.quote.decision} kind="decision" /> },
                { label: "Gross premium", value: formatCurrency(policy.quote.grossPremium) },
                { label: "Coverage limit", value: formatCurrency(policy.quote.coverageLimit) },
                { label: "Pricing version", value: policy.quote.pricingVersion, mono: true },
                { label: "Rules version", value: policy.quote.rulesVersion, mono: true },
              ]}
            />
          ) : (
            <p className="text-xs text-muted">No originating quote linked.</p>
          )}
        </DetailSection>

        <DetailSection
          title="Renewals"
          description="Offers generated against this policy."
          action={<Badge variant="neutral">{renewals.length}</Badge>}
        >
          {renewals.length === 0 ? (
            <p className="text-xs text-muted">No renewal offers recorded.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Premium</TableHead>
                  <TableHead>New term</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {renewals.map((renewal) => (
                  <TableRow key={renewal.id}>
                    <TableCell>
                      <Link href={`/renewals/${renewal.reference}`} className="font-mono text-xs text-primary hover:underline">
                        {renewal.reference}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <StatusBadge value={renewal.status} kind="renewal" />
                    </TableCell>
                    <TableCell className="text-right tabular">{formatCurrency(renewal.offeredPremium)}</TableCell>
                    <TableCell className="text-xs text-muted">
                      {formatDate(renewal.effectiveFrom)} – {formatDate(renewal.effectiveTo)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DetailSection>
      </div>

      <DetailSection
        title="Endorsements"
        description="Mid-term changes; the original policy record is never overwritten."
        action={<Badge variant="neutral">{endorsements.length}</Badge>}
      >
        {endorsements.length === 0 ? (
          <p className="text-xs text-muted">No endorsements recorded.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead className="text-right">Premium delta</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {endorsements.map((endorsement) => (
                <TableRow key={endorsement.id}>
                  <TableCell>
                    <Link href={`/endorsements/${endorsement.reference}`} className="font-mono text-xs text-primary hover:underline">
                      {endorsement.reference}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted">{humanize(endorsement.type)}</TableCell>
                  <TableCell>
                    <StatusBadge value={endorsement.status} kind="endorsement" />
                  </TableCell>
                  <TableCell className="text-muted">{formatDate(endorsement.effectiveDate)}</TableCell>
                  <TableCell className="text-right tabular">{formatCurrency(endorsement.premiumDelta)}</TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted">{endorsement.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DetailSection>
    </div>
  );
}
