import { Download, FileCode2, FileJson, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

const ENTITIES: { value: string; label: string }[] = [
  { value: "applicants", label: "Applicants" },
  { value: "assets", label: "Insured assets" },
  { value: "products", label: "Products" },
  { value: "quotes", label: "Quotes" },
  { value: "policies", label: "Policies" },
  { value: "endorsements", label: "Endorsements" },
  { value: "renewals", label: "Renewals" },
  { value: "underwriting", label: "Underwriting" },
  { value: "findings", label: "Validation findings" },
];

/**
 * Exports are plain authenticated GETs to the existing export endpoint, so a
 * download is produced by the same deterministic projection used for checksums.
 */
export function ExportLinks() {
  return (
    <div className="space-y-4">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="h-9 px-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Dataset</th>
              <th className="h-9 px-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">CSV</th>
              <th className="h-9 px-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">JSON</th>
            </tr>
          </thead>
          <tbody>
            {ENTITIES.map((entity) => (
              <tr key={entity.value} className="border-b border-border last:border-0">
                <td className="px-2 py-2 text-xs">{entity.label}</td>
                <td className="px-2 py-2">
                  <a
                    href={`/api/exports/data?entity=${entity.value}&format=csv`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <FileSpreadsheet aria-hidden className="size-3.5" />
                    CSV
                  </a>
                </td>
                <td className="px-2 py-2">
                  <a
                    href={`/api/exports/data?entity=${entity.value}&format=json`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <FileJson aria-hidden className="size-3.5" />
                    JSON
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <a
          href="/api/exports/data?entity=all&format=json"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Download aria-hidden />
          Full dataset (JSON)
        </a>
        <a
          href="/api/exports/data?entity=all&format=csv"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <Download aria-hidden />
          Summary manifest (CSV)
        </a>
        <a
          href="/api/exports/data?entity=all&format=sql"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          <FileCode2 aria-hidden />
          Master data (SQL)
        </a>
        <p className="text-[11px] text-muted">
          SQL contains product, coverage and rating-factor seed inserts only. Transactional data is exported as CSV/JSON.
        </p>
      </div>
    </div>
  );
}
