import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";

interface PaginationProps {
  basePath: string;
  page: number;
  pageSize: number;
  pages: number;
  total: number;
  query: Record<string, string | undefined>;
}

function hrefFor(basePath: string, query: Record<string, string | undefined>, page: number): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  if (page > 1) params.set("page", String(page));
  else params.delete("page");
  const queryString = params.toString();
  return queryString ? `${basePath}?${queryString}` : basePath;
}

export function Pagination({ basePath, page, pageSize, pages, total, query }: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  const hasPrevious = page > 1;
  const hasNext = page < pages;

  const linkClass =
    "inline-flex h-8 items-center gap-1 rounded-lg border border-border px-3 text-xs font-medium transition-colors";
  const enabledClass = "bg-surface text-foreground hover:bg-surface-muted";
  const disabledClass = "cursor-not-allowed bg-surface-muted text-muted/60";

  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-xs text-muted">
        Showing <span className="font-medium tabular text-foreground">{formatNumber(first)}</span>–
        <span className="font-medium tabular text-foreground">{formatNumber(last)}</span> of{" "}
        <span className="font-medium tabular text-foreground">{formatNumber(total)}</span>
        <span className="ml-2 text-muted/80">
          Page {formatNumber(page)} of {formatNumber(Math.max(pages, 1))}
        </span>
      </p>

      <div className="flex items-center gap-2">
        {hasPrevious ? (
          <Link href={hrefFor(basePath, query, page - 1)} className={cn(linkClass, enabledClass)} rel="prev">
            <ChevronLeft aria-hidden className="size-3.5" />
            Previous
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(linkClass, disabledClass)}>
            <ChevronLeft aria-hidden className="size-3.5" />
            Previous
          </span>
        )}

        {hasNext ? (
          <Link href={hrefFor(basePath, query, page + 1)} className={cn(linkClass, enabledClass)} rel="next">
            Next
            <ChevronRight aria-hidden className="size-3.5" />
          </Link>
        ) : (
          <span aria-disabled="true" className={cn(linkClass, disabledClass)}>
            Next
            <ChevronRight aria-hidden className="size-3.5" />
          </span>
        )}
      </div>
    </nav>
  );
}
