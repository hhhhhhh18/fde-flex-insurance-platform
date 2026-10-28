import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import type { Endorsement, Policy } from "@/types/api";
import { formatCurrency, formatDate, formatDateTime, humanize } from "@/lib/format";
import { DetailHeader, DetailSection, FactGrid } from "@/components/detail/detail-shell";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { ErrorState } from "@/components/states/error-state";

interface EndorsementDetail extends Endorsement {
  policy: Policy;
}

interface RequestedChanges {
  before?: Record<string, string>;
  after?: Record<string, string>;
  newLimit?: string;
  coverageCode?: string;
  pricingDecision?: string;
  pricingReasons?: { code: string; message: string }[];
}

export default async function EndorsementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await apiGet<{ endorsement: EndorsementDetail }>(`/api/endorsements/${encodeURIComponent(id)}`);

  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) {
    return (
      <ErrorState
        title="Endorsement could not be loaded"
        description="The endorsement endpoint did not respond successfully."
        detail={`${result.error} (status ${result.status})`}
      />
    );
  }

  const endorsement = result.data.endorsement;
  const policy = endorsement.policy;
  const changes = (endorsement.requestedChanges ?? {}) as RequestedChanges;
  const before = changes.before ?? {};
  const after = changes.after ?? {};
  const changeRows = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));

  return (
    <div className="space-y-5">
      <DetailHeader
        backHref="/endorsements"
        backLabel="Back to endorsements"
        eyebrow="Endorsement"
        title={endorsement.reference}
        badges={
          <>
            <StatusBadge value={endorsement.status} kind="endorsement" />
            <Badge variant="neutral">{humanize(endorsement.type)}</Badge>
          </>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>Policy</span>
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

      <DetailSection title="Change record" description="Requested change, pricing result and approval evidence.">
        <FactGrid
          columns={4}
          facts={[
            { label: "Type", value: humanize(endorsement.type) },
            { label: "Status", value: humanize(endorsement.status) },
            { label: "Effective date", value: formatDate(endorsement.effectiveDate) },
            { label: "Premium delta", value: formatCurrency(endorsement.premiumDelta) },
            { label: "Coverage code", value: changes.coverageCode ?? "—", mono: true },
            { label: "Pricing decision", value: changes.pricingDecision ?? "—" },
            { label: "Decided by", value: endorsement.approvedBy ? `${humanize(endorsement.approvedByRole ?? "")} · ${endorsement.approvedBy}` : "—" },
            { label: "Decided at", value: endorsement.decidedAt ? formatDateTime(endorsement.decidedAt) : "—" },
          ]}
        />
        <div className="mt-4 rounded-lg border border-border bg-surface-muted/60 p-3">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">Reason</p>
          <p className="mt-1 text-xs leading-relaxed text-foreground">{endorsement.reason}</p>
        </div>
        {endorsement.rejectionReason ? (
          <div className="mt-3 rounded-lg border border-[#fecaca] bg-danger-soft/60 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-danger">Rejection reason</p>
            <p className="mt-1 text-xs text-foreground">{endorsement.rejectionReason}</p>
          </div>
        ) : null}
      </DetailSection>

      <div className="grid gap-5 xl:grid-cols-2">
        <DetailSection title="Before / after" description="Values captured at request time and re-priced through the rating engine.">
          {changeRows.length === 0 ? (
            <p className="text-xs text-muted">No structured change payload recorded.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Field</th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">Before</th>
                  <th className="py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-muted">After</th>
                </tr>
              </thead>
              <tbody>
                {changeRows.map((key) => (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="py-2 capitalize text-muted">{key.replace(/([A-Z])/g, " $1").toLowerCase()}</td>
                    <td className="py-2 text-right tabular">{before[key] ?? "—"}</td>
                    <td className="py-2 text-right tabular font-medium">{after[key] ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DetailSection>

        <DetailSection
          title="Affected policy"
          description="The change applies to this policy on approval."
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
            <p className="text-xs text-muted">Policy not available.</p>
          )}
        </DetailSection>
      </div>
    </div>
  );
}
