import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import type { Policy, Renewal } from "@/types/api";
import { formatCurrency, formatDate, formatDateTime, humanize } from "@/lib/format";
import { DetailHeader, DetailSection, FactGrid } from "@/components/detail/detail-shell";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { ErrorState } from "@/components/states/error-state";

interface RenewalDetail extends Renewal {
  policy: Policy;
}

export default async function RenewalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiGet<{ renewal: RenewalDetail }>(`/api/renewals/${encodeURIComponent(id)}`);

  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) {
    return (
      <ErrorState
        title="Renewal could not be loaded"
        description="The renewal endpoint did not respond successfully."
        detail={`${result.error} (status ${result.status})`}
      />
    );
  }

  const renewal = result.data.renewal;
  const policy = renewal.policy;

  return (
    <div className="space-y-5">
      <DetailHeader
        backHref="/renewals"
        backLabel="Back to renewals"
        eyebrow="Renewal offer"
        title={renewal.reference}
        badges={<StatusBadge value={renewal.status} kind="renewal" />}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Renewal of</span>
            <Link href={`/policies/${policy?.reference}`} className="font-mono text-xs text-primary hover:underline">
              {policy?.reference}
            </Link>
            {policy?.applicant ? (
              <>
                <span aria-hidden>·</span>
                <Link href={`/applicants/${policy.applicant.reference}`} className="text-primary hover:underline">
                  {policy.applicant.firstName} {policy.applicant.lastName}
                </Link>
              </>
            ) : null}
          </span>
        }
      />

      <DetailSection title="Offer terms" description="The successor term is re-priced at inception; it never silently inherits the expiring premium.">
        <FactGrid
          columns={4}
          facts={[
            { label: "Offered premium", value: formatCurrency(renewal.offeredPremium) },
            { label: "Proposed start", value: formatDate(renewal.effectiveFrom) },
            { label: "Proposed end", value: formatDate(renewal.effectiveTo) },
            { label: "Offer expires", value: formatDate(renewal.offerExpiresAt) },
            { label: "Accepted at", value: renewal.acceptedAt ? formatDateTime(renewal.acceptedAt) : "—" },
            { label: "Declined at", value: renewal.declinedAt ? formatDateTime(renewal.declinedAt) : "—" },
            { label: "Status", value: humanize(renewal.status) },
            { label: "Successor policy", value: renewal.resultingPolicy?.reference ?? "Not issued" },
          ]}
        />
        {renewal.declineReason ? (
          <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Decline reason</p>
            <p className="mt-1 text-xs text-foreground">{renewal.declineReason}</p>
          </div>
        ) : null}
      </DetailSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <DetailSection
          title="Expiring policy"
          description="The policy this offer was generated from."
          action={
            policy ? (
              <Link href={`/policies/${policy.reference}`} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                Open policy <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            ) : null
          }
        >
          {policy ? (
            <FactGrid
              columns={2}
              facts={[
                { label: "Reference", value: policy.reference, mono: true },
                { label: "Status", value: <StatusBadge value={policy.status} kind="policy" /> },
                { label: "Premium", value: formatCurrency(policy.premium) },
                { label: "Coverage limit", value: formatCurrency(policy.coverageLimit) },
                { label: "Term", value: `${formatDate(policy.effectiveFrom)} – ${formatDate(policy.effectiveTo)}` },
                { label: "Product", value: policy.product?.name ?? "—" },
              ]}
            />
          ) : (
            <p className="text-xs text-muted">Originating policy not available.</p>
          )}
        </DetailSection>

        <DetailSection title="Successor policy" description="Created when the offer is accepted.">
          {renewal.resultingPolicy ? (
            <div className="space-y-3">
              <FactGrid
                columns={2}
                facts={[
                  { label: "Reference", value: renewal.resultingPolicy.reference, mono: true },
                  { label: "Status", value: <StatusBadge value={renewal.resultingPolicy.status} kind="policy" /> },
                  { label: "Premium", value: formatCurrency(renewal.resultingPolicy.premium) },
                  { label: "Payment", value: humanize(renewal.resultingPolicy.paymentStatus) },
                ]}
              />
              <Link
                href={`/policies/${renewal.resultingPolicy.reference}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Open successor policy <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
          ) : (
            <p className="text-xs leading-relaxed text-muted">
              No successor policy yet. Acceptance creates a policy in pending-payment status, which must then be activated once premium is
              collected.
            </p>
          )}
        </DetailSection>
      </div>
    </div>
  );
}
