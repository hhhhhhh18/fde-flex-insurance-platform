import Link from "next/link";
import { Building2 } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import { parseListParams, toQueryString, toUrlQuery } from "@/lib/list-params";
import type { Asset, Paged } from "@/types/api";
import { formatCurrency, formatNumber, humanize } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RecordFilterBar } from "@/components/data-tables/record-filter-bar";
import { Pagination } from "@/components/data-tables/pagination";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

export const metadata = { title: "Insured assets" };

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await parseListParams(searchParams);
  const result = await apiGet<Paged<Asset>>(`/api/assets?${toQueryString(params)}`);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Portfolio"
        title="Insured assets"
        description="Scheduled risks backing quotes and policies, including deliberate data-quality gaps."
        actions={<RefreshButton />}
      />

      <RecordFilterBar
        query={toUrlQuery(params)}
        search={{ label: "Search assets", placeholder: "Reference, description or applicant…" }}
        filters={[
          {
            key: "status",
            label: "Asset type",
            allLabel: "All asset types",
            options: [
              { value: "VEHICLE", label: "Vehicle" },
              { value: "BUILDING", label: "Building" },
              { value: "MACHINERY", label: "Machinery" },
              { value: "SOLAR_PLANT", label: "Solar plant" },
              { value: "IT_INFRASTRUCTURE", label: "IT infrastructure" },
            ],
          },
        ]}
      />

      {!result.ok ? (
        <ErrorState
          title="Assets could not be loaded"
          description="The assets endpoint did not respond successfully."
          detail={`${result.error} (status ${result.status})`}
          action={<RefreshButton />}
        />
      ) : result.data.total === 0 ? (
        <EmptyState
          title={params.q || params.status ? "No assets match these filters" : "No insured assets recorded"}
          description={
            params.q || params.status
              ? "Adjust the search term or asset type, or clear the filters."
              : "Generate the synthetic portfolio to populate insured assets."
          }
          action={
            params.q || params.status ? (
              <Link href="/assets" className="text-xs font-medium text-primary hover:underline">
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div className="flex items-center gap-2">
              <Building2 aria-hidden className="size-4 text-muted" />
              <h2 className="text-sm font-semibold text-foreground">Asset register</h2>
            </div>
            <Badge variant="neutral">{formatNumber(result.data.total)} records</Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="hidden md:table-cell">Applicant</TableHead>
                <TableHead className="text-right">Current value</TableHead>
                <TableHead className="hidden lg:table-cell">Condition</TableHead>
                <TableHead>Risk data</TableHead>
                <TableHead className="text-right">Policies</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.items.map((asset) => (
                <TableRow key={asset.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/assets/${asset.id}`} className="text-primary hover:underline">
                      {asset.reference}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/assets/${asset.id}`} className="font-medium hover:underline">
                      {asset.description}
                    </Link>
                    <p className="text-[11px] text-muted">{asset.region}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted">{humanize(asset.assetType)}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {asset.applicant ? (
                      <Link href={`/applicants/${asset.applicant.reference}`} className="text-muted hover:text-foreground hover:underline">
                        {asset.applicant.firstName} {asset.applicant.lastName}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular">{formatCurrency(asset.currentValue)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted">{humanize(asset.condition)}</TableCell>
                  <TableCell>
                    {asset.riskDataComplete ? (
                      <Badge variant="success">Complete</Badge>
                    ) : (
                      <Badge variant="warning">Missing {asset.missingRiskField ?? "fields"}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular">{formatNumber(asset._count?.policies ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <Pagination
            basePath="/assets"
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
