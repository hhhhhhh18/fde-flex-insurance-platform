"use client";

import { formatCurrency, formatNumber } from "@/lib/format";

interface TooltipPayloadItem {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormat = "number",
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string | number;
  valueFormat?: "number" | "currency";
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      {label !== undefined ? <p className="mb-1 font-medium text-foreground">{String(label)}</p> : null}
      <ul className="space-y-0.5">
        {payload.map((item) => (
          <li key={String(item.dataKey ?? item.name)} className="flex items-center gap-2 text-muted">
            <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="capitalize">{String(item.name ?? item.dataKey)}</span>
            <span className="ml-auto font-medium tabular text-foreground">
              {valueFormat === "currency"
                ? formatCurrency(Number(item.value ?? 0))
                : formatNumber(Number(item.value ?? 0))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
