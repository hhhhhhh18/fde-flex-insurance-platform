import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import { parseListParams, toQueryString, toUrlQuery } from "@/lib/list-params";
import type { Paged, Quote } from "@/types/api";
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

export const metadata = { title: "Quotes" };

export default async function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await parseListParams(searchParams);
  const result = await apiGet<Paged<Quote>>(`/api/quotes?${toQueryString(params)}`);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Transactions"
        title="Quotes"
        description="Every evaluation is priced by the single rating engine and stores its decision, factor breakdown and rule versions."
        actions={
          <>
            <RefreshButton />
            <Link
              href="/quotes/new"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-[#172e6e]"
            >
              <Plus aria-hidden className="size-3.5" />
              New evaluation
            </Link>
          </>
        }
      />

      <RecordFilterBar
        query={toUrlQuery(params)}
        search={{ label: "Search quotes", placeholder: "Quote reference, applicant or product…" }}
        filters={[
          {
            key: "status",
            label: "Decision",
            allLabel: "All decisions",
            options: [
              { value: "ELIGIBLE", label: "Eligible" },
              { value: "REFERRED", label: "Referred" },
              { value: "AWAITING_INFORMATION", label: "Awaiting information" },
              { value: "INELIGIBLE", label: "Ineligible" },
            ],
          },
        ]}
      />

      {!result.ok ? (
        <ErrorState
          title="Quotes could not be loaded"
          description="The quotes endpoint did not respond successfully."
          detail={`${result.error} (status ${result.status})`}
          action={<RefreshButton />}
        />
      ) : result.data.total === 0 ? (
        <EmptyState
          title={params.q || params.status ? "No quotes match these filters" : "No quotes recorded"}
          description={
            params.q || params.status
              ? "Adjust the search term or decision filter, or clear the filters."
              : "Quotes appear here once an evaluation has been submitted."
          }
          action={
            params.q || params.status ? (
              <Link href="/quotes" className="text-xs font-medium text-primary hover:underline">
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div className="flex items-center gap-2">
              <FileText aria-hidden className="size-4 text-muted" />
              <h2 className="text-sm font-semibold text-foreground">Quote register</h2>
            </div>
            <Badge variant="neutral">{formatNumber(result.data.total)} records</Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead>Product</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Coverage limit</TableHead>
                <TableHead className="text-right">Gross premium</TableHead>
                <TableHead>Evaluated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.items.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell>
                    <Link href={`/quotes/${quote.reference}`} className="font-mono text-xs text-primary hover:underline">
                      {quote.reference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {quote.applicant ? (
                      <Link href={`/applicants/${quote.applicant.reference}`} className="hover:underline">
                        {quote.applicant.firstName} {quote.applicant.lastName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-muted">{quote.product?.name ?? "—"}</TableCell>
                  <TableCell>
                    <StatusBadge value={quote.decision} kind="decision" />
                  </TableCell>
                  <TableCell className="text-muted text-xs">{quote.status}</TableCell>
                  <TableCell className="text-right tabular">{formatCurrency(quote.coverageLimit)}</TableCell>
                  <TableCell className="text-right tabular font-medium">{formatCurrency(quote.grossPremium)}</TableCell>
                  <TableCell className="text-muted">{formatDate(quote.evaluatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            basePath="/quotes"
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
