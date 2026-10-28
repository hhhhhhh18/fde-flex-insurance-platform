import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import { parseListParams, toQueryString, toUrlQuery } from "@/lib/list-params";
import type { Paged, Renewal } from "@/types/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
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

export const metadata = { title: "Renewals" };

export default async function RenewalsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await parseListParams(searchParams);
  const result = await apiGet<Paged<Renewal>>(`/api/renewals?${toQueryString(params)}`);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Transactions"
        title="Renewals"
        description="Offers generated for policies approaching expiry. Cancelled policies are never renewable; each acceptance produces a successor policy with its own quote."
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
              { value: "OFFERED", label: "Offered" },
              { value: "ACCEPTED", label: "Accepted" },
              { value: "DECLINED", label: "Declined" },
              { value: "EXPIRED", label: "Expired" },
            ],
          },
        ]}
      />

      {!result.ok ? (
        <ErrorState
          title="Renewals could not be loaded"
          description="The renewals endpoint did not respond successfully."
          detail={`${result.error} (status ${result.status})`}
          action={<RefreshButton />}
        />
      ) : result.data.total === 0 ? (
        <EmptyState
          title={params.status ? "No renewals match this status" : "No renewal offers"}
          description={
            params.status
              ? "Try another status or clear the filter."
              : "Renewal offers are generated from active policies approaching expiry."
          }
          action={
            params.status ? (
              <Link href="/renewals" className="text-xs font-medium text-primary hover:underline">
                Clear filter
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div className="flex items-center gap-2">
              <RefreshCw aria-hidden className="size-4 text-muted" />
              <h2 className="text-sm font-semibold text-foreground">Renewal register</h2>
            </div>
            <Badge variant="neutral">{formatNumber(result.data.total)} records</Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Offered premium</TableHead>
                <TableHead>Proposed term</TableHead>
                <TableHead>Offer expires</TableHead>
                <TableHead>Successor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.items.map((renewal) => (
                <TableRow key={renewal.id}>
                  <TableCell>
                    <Link href={`/renewals/${renewal.reference}`} className="font-mono text-xs text-primary hover:underline">
                      {renewal.reference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {renewal.policy ? (
                      <Link href={`/policies/${renewal.policy.reference}`} className="font-mono text-xs hover:underline">
                        {renewal.policy.reference}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted">
                    {renewal.policy?.applicant ? `${renewal.policy.applicant.firstName} ${renewal.policy.applicant.lastName}` : "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge value={renewal.status} kind="renewal" />
                  </TableCell>
                  <TableCell className="text-right tabular font-medium">{formatCurrency(renewal.offeredPremium)}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted">
                    {formatDate(renewal.effectiveFrom)} – {formatDate(renewal.effectiveTo)}
                  </TableCell>
                  <TableCell className="text-muted">{formatDate(renewal.offerExpiresAt)}</TableCell>
                  <TableCell>
                    {renewal.resultingPolicy ? (
                      <Link href={`/policies/${renewal.resultingPolicy.reference}`} className="font-mono text-xs text-primary hover:underline">
                        {renewal.resultingPolicy.reference}
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            basePath="/renewals"
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
