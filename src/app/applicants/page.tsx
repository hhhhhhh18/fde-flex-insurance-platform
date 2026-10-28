import Link from "next/link";
import { Users } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import { parseListParams, toQueryString, toUrlQuery } from "@/lib/list-params";
import type { Applicant, Paged } from "@/types/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordFilterBar } from "@/components/data-tables/record-filter-bar";
import { Pagination } from "@/components/data-tables/pagination";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

export const metadata = { title: "Applicants" };

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await parseListParams(searchParams);
  const result = await apiGet<Paged<Applicant>>(`/api/applicants?${toQueryString(params)}`);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Portfolio"
        title="Applicants"
        description="Fictional policyholders and the assets, quotes and policies attached to them."
        actions={<RefreshButton />}
      />

      <RecordFilterBar
        query={toUrlQuery(params)}
        search={{ label: "Search applicants", placeholder: "Name, reference, email or region…" }}
      />

      {!result.ok ? (
        <ErrorState
          title="Applicants could not be loaded"
          description="The applicants endpoint did not respond successfully."
          detail={`${result.error} (status ${result.status})`}
          action={<RefreshButton />}
        />
      ) : result.data.total === 0 ? (
        <EmptyState
          title={params.q ? "No applicants match this search" : "No applicants recorded"}
          description={
            params.q
              ? `Nothing matched “${params.q}”. Try a name, reference, email or region.`
              : "Generate the synthetic portfolio to populate applicants."
          }
          action={
            params.q ? (
              <Link href="/applicants" className="text-xs font-medium text-primary hover:underline">
                Clear search
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div className="flex items-center gap-2">
              <Users aria-hidden className="size-4 text-muted" />
              <h2 className="text-sm font-semibold text-foreground">Applicant register</h2>
            </div>
            <Badge variant="neutral">{formatNumber(result.data.total)} records</Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Applicant</TableHead>
                <TableHead className="hidden md:table-cell">Region</TableHead>
                <TableHead className="hidden lg:table-cell">Occupation</TableHead>
                <TableHead className="hidden sm:table-cell">Credit</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Annual income</TableHead>
                <TableHead className="text-right">Assets</TableHead>
                <TableHead className="text-right">Quotes</TableHead>
                <TableHead className="text-right">Policies</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.items.map((applicant) => (
                <TableRow key={applicant.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/applicants/${applicant.id}`} className="text-primary hover:underline">
                      {applicant.reference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/applicants/${applicant.id}`} className="font-medium hover:underline">
                      {applicant.firstName} {applicant.lastName}
                    </Link>
                    <p className="text-[11px] text-muted">{applicant.email}</p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted">{applicant.region}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted">{applicant.occupation}</TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="neutral" className="font-mono">
                      {applicant.creditBand}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right tabular text-muted">
                    {formatCurrency(applicant.annualIncome)}
                  </TableCell>
                  <TableCell className="text-right tabular">{formatNumber(applicant._count?.assets ?? 0)}</TableCell>
                  <TableCell className="text-right tabular">{formatNumber(applicant._count?.quotes ?? 0)}</TableCell>
                  <TableCell className="text-right tabular">{formatNumber(applicant._count?.policies ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            basePath="/applicants"
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
