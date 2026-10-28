import Link from "next/link";
import { Package } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import type { ProductsResponse } from "@/types/api";
import { formatCurrency, formatNumber, humanize } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

export const metadata = { title: "Products" };

export default async function ProductsPage() {
  const result = await apiGet<ProductsResponse>("/api/products");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Portfolio"
        title="Products"
        description="Configurable products, coverage options and rate tables consumed by the pricing engine."
        actions={<RefreshButton />}
      />

      {!result.ok ? (
        <ErrorState
          title="Products could not be loaded"
          description="The products endpoint did not respond successfully."
          detail={`${result.error} (status ${result.status})`}
          action={<RefreshButton />}
        />
      ) : result.data.items.length === 0 ? (
        <EmptyState title="No products configured" description="Seed the master data to create insurance products." />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
            <div className="flex items-center gap-2">
              <Package aria-hidden className="size-4 text-muted" />
              <h2 className="text-sm font-semibold text-foreground">Product catalogue</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="neutral">{formatNumber(result.data.items.length)} products</Badge>
              <Badge variant="outline">{formatNumber(result.data.globalRiskFactors.length)} global factors</Badge>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell text-right">Base rate</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Minimum premium</TableHead>
                <TableHead className="hidden xl:table-cell text-right">Max coverage</TableHead>
                <TableHead className="text-right">Options</TableHead>
                <TableHead className="text-right">Quotes</TableHead>
                <TableHead className="text-right">Policies</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.data.items.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="font-mono text-xs">
                    <Link href={`/products/${product.code}`} className="text-primary hover:underline">
                      {product.code}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/products/${product.code}`} className="font-medium hover:underline">
                      {product.name}
                    </Link>
                    <p className="max-w-[320px] truncate text-[11px] text-muted">{product.description}</p>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted">{humanize(product.category)}</TableCell>
                  <TableCell>
                    <Badge variant={product.status === "ACTIVE" ? "success" : "neutral"}>{humanize(product.status)}</Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular">
                    {Number(product.baseRate).toFixed(4)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right tabular">
                    {formatCurrency(product.minimumPremium)}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-right tabular">
                    {formatCurrency(product.maxCoverageLimit)}
                  </TableCell>
                  <TableCell className="text-right tabular">{formatNumber(product.coverageOptions.length)}</TableCell>
                  <TableCell className="text-right tabular">{formatNumber(product._count?.quotes ?? 0)}</TableCell>
                  <TableCell className="text-right tabular">{formatNumber(product._count?.policies ?? 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
