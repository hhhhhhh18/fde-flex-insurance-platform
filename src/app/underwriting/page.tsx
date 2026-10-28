import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import type { Applicant, Asset, Product, Quote } from "@/types/api";
import { getActingRole } from "@/lib/session";
import { can } from "@/lib/authz";
import { formatCurrency, formatDateTime, formatNumber, humanize } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { DecisionPanel } from "@/components/underwriting/decision-panel";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

export const metadata = { title: "Underwriting" };

interface QueueItem {
  id: string;
  reference: string;
  status: string;
  triggerCodes: string[];
  summary: string;
  notes: string | null;
  requestedInfo: string | null;
  reviewerRole: string | null;
  decidedAt: string | null;
  createdAt: string;
  quote: Quote & {
    applicant: Applicant;
    product: Product;
    asset: Asset | null;
  };
}

interface QueueResponse {
  pending: QueueItem[];
  recent: QueueItem[];
}

export default async function UnderwritingPage() {
  const [role, queueResult] = await Promise.all([getActingRole(), apiGet<QueueResponse>("/api/underwriting/queue")]);
  const canDecide = can(role, "underwriting:decide");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Underwriting queue"
        description="Referrals raised by deterministic pricing thresholds. Decisions are recorded against your role and monetary authority."
        actions={<RefreshButton />}
      />

      {!queueResult.ok ? (
        <ErrorState
          title="Queue could not be loaded"
          description="The underwriting endpoint did not respond successfully."
          detail={`${queueResult.error} (status ${queueResult.status})`}
          action={<RefreshButton />}
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={queueResult.data.pending.length > 0 ? "warning" : "success"}>
              {formatNumber(queueResult.data.pending.length)} open
            </Badge>
            <Badge variant="neutral">{formatNumber(queueResult.data.recent.length)} recent decisions</Badge>
            <span className="text-[11px] text-muted">
              Acting as {humanize(role)} · {canDecide ? "decision authority available" : "read-only"}
            </span>
          </div>

          {queueResult.data.pending.length === 0 ? (
            <EmptyState
              title="No referrals awaiting a decision"
              description="Quotes that breach a referral threshold will appear here with their trigger reasons."
            />
          ) : (
            <div className="space-y-4">
              {queueResult.data.pending.map((item) => {
                const quote = item.quote;
                return (
                  <Card key={item.id}>
                    <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <ClipboardCheck aria-hidden className="size-4 text-muted" />
                          <CardTitle className="font-mono">{item.reference}</CardTitle>
                          <StatusBadge value={item.status} kind="underwriting" />
                          <Badge variant="neutral">Raised {formatDateTime(item.createdAt)}</Badge>
                        </div>
                        <CardDescription className="mt-1">
                          {quote.applicant.firstName} {quote.applicant.lastName} ·{" "}
                          <Link href={`/applicants/${quote.applicant.reference}`} className="hover:underline">
                            {quote.applicant.reference}
                          </Link>{" "}
                          · {quote.product.name}
                          {quote.asset ? ` · ${quote.asset.description}` : ""}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-muted">Gross premium</p>
                        <p className="text-lg font-semibold tabular">{formatCurrency(quote.grossPremium)}</p>
                        <Link href={`/quotes/${quote.id}`} className="text-[11px] font-medium text-primary hover:underline">
                          {quote.reference}
                        </Link>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-xs leading-relaxed text-muted">{item.summary}</p>

                      <div className="flex flex-wrap gap-1.5">
                        {item.triggerCodes.map((code) => (
                          <Badge key={code} variant="warning" className="font-mono">
                            {code}
                          </Badge>
                        ))}
                        <Badge variant="neutral">Coverage {formatCurrency(quote.coverageLimit)}</Badge>
                      </div>

                      {quote.referralReasons.length > 0 ? (
                        <ul className="space-y-1 border-l-2 border-[#fde68a] pl-3">
                          {quote.referralReasons.map((reason) => (
                            <li key={reason.code} className="text-[11px] leading-relaxed text-muted">
                              <span className="font-mono text-foreground">{reason.code}</span> — {reason.message}
                            </li>
                          ))}
                        </ul>
                      ) : null}

                      {canDecide ? (
                        <DecisionPanel decisionId={item.id} reference={item.reference} canDecide={canDecide} />
                      ) : (
                        <p className="rounded-lg border border-border bg-surface-muted px-3 py-2 text-[11px] text-muted">
                          Decision requires the Risk reviewer or Admin role. Switch role in the header to action this
                          case.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
              <h2 className="text-sm font-semibold">Recent decisions</h2>
              <Badge variant="neutral">{formatNumber(queueResult.data.recent.length)}</Badge>
            </div>
            {queueResult.data.recent.length === 0 ? (
              <p className="px-5 pb-5 text-xs text-muted">No referrals have been decided yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Quote</TableHead>
                    <TableHead className="hidden md:table-cell">Applicant</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Reviewer</TableHead>
                    <TableHead className="hidden lg:table-cell">Decided</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {queueResult.data.recent.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-mono text-xs">{item.reference}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <Link href={`/quotes/${item.quote.id}`} className="text-primary hover:underline">
                          {item.quote.reference}
                        </Link>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted">
                        {item.quote.applicant.firstName} {item.quote.applicant.lastName}
                      </TableCell>
                      <TableCell>
                        <StatusBadge value={item.status} kind="underwriting" />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-muted">
                        {item.reviewerRole ? humanize(item.reviewerRole) : "—"}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted">
                        {item.decidedAt ? formatDateTime(item.decidedAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
