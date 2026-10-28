"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDefinition {
  key: string;
  label: string;
  allLabel: string;
  options: FilterOption[];
}

interface RecordFilterBarProps {
  /** Current URL state, passed from the server page (avoids useSearchParams). */
  query: Record<string, string | undefined>;
  filters?: FilterDefinition[];
  search?: {
    label: string;
    placeholder: string;
  };
  className?: string;
}

function buildUrl(pathname: string, merged: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  params.delete("page");
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

/**
 * Search + filter controls backed by URL state. Every change resets pagination
 * so a filter can never point at a page that no longer exists.
 */
export function RecordFilterBar({ query, filters = [], search, className }: RecordFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [term, setTerm] = useState(query.q ?? "");
  const lastPushed = useRef(query.q ?? "");

  // Keep the input in sync when the server renders a different query (back/forward navigation).
  useEffect(() => {
    if ((query.q ?? "") !== lastPushed.current) {
      lastPushed.current = query.q ?? "";
      setTerm(query.q ?? "");
    }
  }, [query.q]);

  useEffect(() => {
    if (!search) return;
    if (term === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = term;
      router.replace(buildUrl(pathname, { ...query, q: term || undefined }), { scroll: false });
    }, 350);
    return () => clearTimeout(timer);
  }, [term, query, pathname, router, search]);

  function setFilter(key: string, value: string) {
    router.replace(buildUrl(pathname, { ...query, [key]: value || undefined }), { scroll: false });
  }

  const hasFilters = Boolean(query.q) || filters.some((filter) => Boolean(query[filter.key]));

  return (
    <div className={cn("flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3 sm:flex-row sm:items-end", className)}>
      {search ? (
        <form
          className="flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            lastPushed.current = term;
            router.replace(buildUrl(pathname, { ...query, q: term || undefined }), { scroll: false });
          }}
          role="search"
        >
          <label htmlFor="record-search" className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
            {search.label}
          </label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input
              id="record-search"
              type="search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder={search.placeholder}
              className="h-10 w-full rounded-lg border border-border bg-surface pl-9 pr-9 text-sm text-foreground placeholder:text-muted/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            />
            {term ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => {
                  setTerm("");
                  lastPushed.current = "";
                  router.replace(buildUrl(pathname, { ...query, q: undefined }), { scroll: false });
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground"
              >
                <X aria-hidden className="size-4" />
              </button>
            ) : null}
          </div>
        </form>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        {filters.map((filter) => (
          <div key={filter.key} className="min-w-[150px]">
            <label htmlFor={`filter-${filter.key}`} className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-muted">
              {filter.label}
            </label>
            <select
              id={`filter-${filter.key}`}
              value={query[filter.key] ?? ""}
              onChange={(event) => setFilter(filter.key, event.target.value)}
              className="h-10 w-full cursor-pointer rounded-lg border border-border bg-surface px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <option value="">{filter.allLabel}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {hasFilters ? (
          <Button variant="ghost" size="sm" asChild className="mb-0.5">
            <a href={pathname}>Clear filters</a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
