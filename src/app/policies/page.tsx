import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import { parseListParams, toQueryString, toUrlQuery } from "@/lib/list-params";
import type { Paged, Policy } from "@/types/api";
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

export const metadata = { title: "Policies" };

export default async function PoliciesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await parseListParams(searchParams);
  const result = await apiGet<Paged<Policy>>(`/api/policies?${toQueryString(params)}`);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Transactions"
        title="Policies"
        description="Issued cover with payment state, term dates and the authority that bound it. Status changes are recorded as audited lifecycle transitions."
        actions={<RefreshButton />}
      />

      <RecordFilterBar
        query={toUrlQuery(params)}
        search={{ label: "Search policies", placeholder: "Policy reference or applicant…" }}
        filters={[
          {
            key: "status",
            label: "Status",
            allLabel: "All statuses",
            options: [
              { value: "ACTIVE", label: "Active" },
              { value: "PENDING_PAYMENT", label: "Pending payment" },
              { value: "CANCELLED", label: "Cancelled" },
              { value: "EXPIRED", label: "Expired" },
            ],
          },
        ]}
      />

      {!result.ok ? (
        <ErrorState
          title="Policies could not be loaded"
          description="The policies endpoint did not respond successfully."
          detail={`${result.error} (status ${result.status})`}
          action={<RefreshButton />}
        />
      ) : result.data.total === 0 ? (
        <EmptyState
          title={params.q || params.status ? "No policies match these filters" : "No policies issued"}
          description={
            params.q || params.status
              ? "Adjust the search term or status filter, or clear the filters."
              : "Policies appear here after an eligible quote is issued."
          }
          action={
            params.q || params.status ? (
              <Link href="/policies" className="text-xs font-medium text-primary hover:underline">
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div className="flex items-center gap-2">
              <ShieldCheck aria-hidden className="size-4 text-muted" />
              <h2 className="text-sm font-semibold text-foreground">Policy register</h2>
            </div>
            <Badge variant="neutral">{formatNumber(result.data.total)} records</Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Term</TableHead>
                <TableHead className="text-right">Premium</TableHead>
                <TableHead className="text-right">Coverage</TableHead>
                <TableHead>Issued by</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.items.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <Link href={`/policies/${policy.reference}`} className="font-mono text-xs text-primary hover:underline">
                      {policy.reference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {policy.applicant ? (
                      <Link href={`/applicants/${policy.applicant.reference}`} className="hover:underline">
                        {policy.applicant.firstName} {policy.applicant.lastName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted">{policy.product?.name ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge value={policy.status} kind="policy" />
                  </TableCell>
                  <TableCell>
                    <Badge variant={policy.paymentStatus === "PAID" ? "success" : policy.paymentStatus === "REFUNDED" ? "info" : "warning"}>
                      {humanize(policy.paymentStatus)}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted">
                    {formatDate(policy.effectiveFrom)} – {formatDate(policy.effectiveTo)}
                  </TableCell>
                  <TableCell className="text-right tabular font-medium">{formatCurrency(policy.premium)}</TableCell>
                  <TableCell className="text-right tabular">{formatCurrency(policy.coverageLimit)}</TableCell>
                  <TableCell className="text-xs text-muted">{humanize(policy.issuedByRole)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            basePath="/policies"
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
