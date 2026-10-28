import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import type { Product } from "@/types/api";
import { getActingRole } from "@/lib/session";
import { can } from "@/lib/authz";
import { PageHeader } from "@/components/layout/page-header";
import { QuoteEvaluationForm } from "@/components/quoting/quote-evaluation-form";
import { ErrorState } from "@/components/states/error-state";
import { EmptyState } from "@/components/states/empty-state";

export const metadata = { title: "New quote evaluation" };

export default async function NewQuotePage() {
  const [role, productsResult] = await Promise.all([getActingRole(), apiGet<{ items: Product[] }>("/api/products")]);

  const canEvaluate = can(role, "quote:evaluate");

  return (
    <div className="space-y-5">
      <Link href="/quotes" className="inline-flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground">
        <ArrowLeft aria-hidden className="size-3.5" />
        Back to quotes
      </Link>

      <PageHeader
        eyebrow="Transactions"
        title="Evaluate a quote"
        description="Rate a risk against a product's rate table, eligibility conditions and referral thresholds, then persist the decision."
      />

      {!productsResult.ok ? (
        <ErrorState
          title="Products could not be loaded"
          description="The quote form needs the product catalogue to render coverage options."
          detail={`${productsResult.error} (status ${productsResult.status})`}
        />
      ) : productsResult.data.items.length === 0 ? (
        <EmptyState title="No products configured" description="Seed the master data before evaluating quotes." />
      ) : (
        <QuoteEvaluationForm products={productsResult.data.items} canEvaluate={canEvaluate} />
      )}
    </div>
  );
}
