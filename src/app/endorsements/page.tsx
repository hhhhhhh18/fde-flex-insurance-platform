import Link from "next/link";
import { FileCheck2 } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import { parseListParams, toQueryString, toUrlQuery } from "@/lib/list-params";
import type { Endorsement, Paged } from "@/types/api";
import { formatCurrency, formatDate, formatNumber, humanize } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordFilterBar } from "@/components/data-tables/record-filter-bar";
import { Pagination } from "@/components/data-tables/pagination";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

export const metadata = { title: "Endorsements" };

export default async function EndorsementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await parseListParams(searchParams);
  const result = await apiGet<Paged<Endorsement>>(`/api/endorsements?${toQueryString(params)}`);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Transactions"
        title="Endorsements"
        description="Mid-term policy changes captured as separate, auditable records. Approval applies the change without overwriting the original policy history."
        actions={<RefreshButton />}
      />

      <RecordFilterBar
        query={toUrlQuery(params)}
        filters={[
          {
            key: "status",
            label: "Status",
            allLabel: "All statuses",
            options: [
              { value: "PENDING", label: "Pending" },
              { value: "APPROVED", label: "Approved" },
              { value: "APPLIED", label: "Applied" },
              { value: "REJECTED", label: "Rejected" },
            ],
          },
        ]}
      />

      {!result.ok ? (
        <ErrorState
          title="Endorsements could not be loaded"
          description="The endorsements endpoint did not respond successfully."
          detail={`${result.error} (status ${result.status})`}
          action={<RefreshButton />}
        />
      ) : result.data.total === 0 ? (
        <EmptyState
          title={params.status ? "No endorsements match this status" : "No endorsements recorded"}
          description={
            params.status ? "Try another status or clear the filter." : "Mid-term changes will appear here once requested against an active policy."
          }
          action={
            params.status ? (
              <Link href="/endorsements" className="text-xs font-medium text-primary hover:underline">
                Clear filter
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div className="flex items-center gap-2">
              <FileCheck2 aria-hidden className="size-4 text-muted" />
              <h2 className="text-sm font-semibold text-foreground">Endorsement register</h2>
            </div>
            <Badge variant="neutral">{formatNumber(result.data.total)} records</Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead className="text-right">Premium delta</TableHead>
                <TableHead>Decided</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.items.map((endorsement) => (
                <TableRow key={endorsement.id}>
                  <TableCell>
                    <Link href={`/endorsements/${endorsement.reference}`} className="font-mono text-xs text-primary hover:underline">
                      {endorsement.reference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {endorsement.policy ? (
                      <Link href={`/policies/${endorsement.policy.reference}`} className="font-mono text-xs hover:underline">
                        {endorsement.policy.reference}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted">
                    {endorsement.policy?.applicant
                      ? `${endorsement.policy.applicant.firstName} ${endorsement.policy.applicant.lastName}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-muted">{humanize(endorsement.type)}</TableCell>
                  <TableCell>
                    <StatusBadge value={endorsement.status} kind="endorsement" />
                  </TableCell>
                  <TableCell className="text-muted">{formatDate(endorsement.effectiveDate)}</TableCell>
                  <TableCell className={`text-right tabular ${Number(endorsement.premiumDelta) < 0 ? "text-success" : ""}`}>
                    {formatCurrency(endorsement.premiumDelta)}
                  </TableCell>
                  <TableCell className="text-muted">{endorsement.decidedAt ? formatDate(endorsement.decidedAt) : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            basePath="/endorsements"
            page={result.data.page}
            pageSize={result.data.pageSize}
            pages={result.data.pages}
            total={result.data.total}
            query={toUrlQuery(params)}
          />
        </Card>
      )}
    </div>
  );
}
