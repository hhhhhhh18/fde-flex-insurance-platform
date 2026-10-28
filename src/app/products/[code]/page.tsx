import { notFound } from "next/navigation";
import { apiGet } from "@/lib/api-client/server";
import type { Product, RiskFactor } from "@/types/api";
import { formatCurrency, formatDate, formatNumber, humanize } from "@/lib/format";
import { DetailHeader, DetailSection, FactGrid } from "@/components/detail/detail-shell";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/states/error-state";

interface ProductDetailResponse {
  product: Product;
  globalRiskFactors: RiskFactor[];
}

export default async function ProductDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await apiGet<ProductDetailResponse>(`/api/products/${encodeURIComponent(code)}`);

  if (!result.ok && result.status === 404) notFound();
  if (!result.ok) {
    return (
      <ErrorState
        title="Product could not be loaded"
        description="The product endpoint did not respond successfully."
        detail={`${result.error} (status ${result.status})`}
      />
    );
  }

  const { product, globalRiskFactors } = result.data;
  const factors = [
    ...product.riskFactors.map((factor) => ({ ...factor, scope: "Product" })),
    ...globalRiskFactors.map((factor) => ({ ...factor, scope: "Global" })),
  ];

  return (
    <div className="space-y-5">
      <DetailHeader
        backHref="/products"
        backLabel="Back to products"
        eyebrow="Product"
        title={product.code}
        badges={
          <>
            <Badge variant={product.status === "ACTIVE" ? "success" : "neutral"}>{humanize(product.status)}</Badge>
            <Badge variant="outline">{humanize(product.category)}</Badge>
          </>
        }
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-foreground">{product.name}</span>
            <span aria-hidden>·</span>
            <span>{product.description}</span>
          </span>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <DetailSection
          title="Rating configuration"
          description="Values read by the pricing engine for every evaluation."
          className="lg:col-span-2"
        >
          <FactGrid
            columns={3}
            facts={[
              { label: "Base rate (per 1,000)", value: Number(product.baseRate).toFixed(6), mono: true },
              { label: "Minimum premium", value: formatCurrency(product.minimumPremium) },
              { label: "Maximum coverage", value: formatCurrency(product.maxCoverageLimit) },
              {
                label: "Referral threshold",
                value: formatCurrency(product.referralThreshold),
                hint: "Gross premium above this is referred",
              },
              {
                label: "Auto-bind limit",
                value: formatCurrency(product.autoBindLimit),
                hint: "Coverage above this is referred",
              },
              {
                label: "Asset value range",
                value: `${formatCurrency(product.minAssetValue)} – ${formatCurrency(product.maxAssetValue)}`,
              },
              { label: "Applicant age band", value: `${product.minApplicantAge} – ${product.maxApplicantAge} years` },
              { label: "Effective from", value: formatDate(product.effectiveFrom) },
              { label: "Effective to", value: product.effectiveTo ? formatDate(product.effectiveTo) : "Open-ended" },
            ]}
          />
        </DetailSection>

        <DetailSection title="Rule versions" description="Snapshotted onto every quote.">
          <FactGrid
            columns={2}
            facts={[
              { label: "Pricing version", value: product.pricingVersion, mono: true },
              { label: "Rules version", value: product.rulesVersion, mono: true },
              { label: "Coverage options", value: formatNumber(product.coverageOptions.length) },
              { label: "Rating factors", value: formatNumber(factors.length) },
              { label: "Quotes evaluated", value: formatNumber(product._count?.quotes ?? 0) },
              { label: "Policies issued", value: formatNumber(product._count?.policies ?? 0) },
            ]}
          />
        </DetailSection>
      </div>

      <DetailSection
        title="Coverage options"
        description="Only options belonging to this product may be requested on a quote."
      >
        {product.coverageOptions.length === 0 ? (
          <p className="text-xs text-muted">No coverage options configured.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Coverage</TableHead>
                <TableHead className="hidden sm:table-cell">Type</TableHead>
                <TableHead className="text-right">Rate factor</TableHead>
                <TableHead className="hidden md:table-cell text-right">Limit range</TableHead>
                <TableHead className="hidden lg:table-cell text-right">Default limit</TableHead>
                <TableHead>Required</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {product.coverageOptions.map((option) => (
                <TableRow key={option.id}>
                  <TableCell className="font-mono text-xs">{option.code}</TableCell>
                  <TableCell>{option.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted">{humanize(option.coverageType)}</TableCell>
                  <TableCell className="text-right tabular">{Number(option.rateFactor).toFixed(4)}</TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular text-muted">
                    {formatCurrency(option.minLimit)} – {formatCurrency(option.maxLimit)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right tabular">
                    {formatCurrency(option.defaultLimit)}
                  </TableCell>
                  <TableCell>
                    {option.required ? (
                      <Badge variant="primary">Required</Badge>
                    ) : (
                      <span className="text-xs text-muted">Optional</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={option.active ? "success" : "neutral"}>{option.active ? "Active" : "Inactive"}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DetailSection>

      <DetailSection
        title="Rating factors"
        description="Multipliers applied by the engine, with referral triggers."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Factor</TableHead>
              <TableHead className="hidden sm:table-cell">Scope</TableHead>
              <TableHead className="hidden md:table-cell">Condition</TableHead>
              <TableHead className="text-right">Multiplier</TableHead>
              <TableHead>Referral</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {factors.map((factor) => (
              <TableRow key={factor.id}>
                <TableCell className="font-mono text-xs">{factor.code}</TableCell>
                <TableCell>
                  <p className="font-medium">{factor.label}</p>
                  <p className="max-w-[440px] text-[11px] text-muted">{factor.explanation}</p>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted">{factor.scope}</TableCell>
                <TableCell className="hidden md:table-cell font-mono text-[11px] text-muted">
                  {humanize(factor.metric)} {factor.operator}{" "}
                  {factor.thresholdValue ? Number(factor.thresholdValue).toString() : (factor.thresholdText ?? "")}
                </TableCell>
                <TableCell className="text-right tabular">{Number(factor.multiplier).toFixed(3)}×</TableCell>
                <TableCell>
                  {factor.triggersReferral ? (
                    <Badge variant="warning">Refers</Badge>
                  ) : (
                    <span className="text-xs text-muted">No</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DetailSection>
    </div>
  );
}
