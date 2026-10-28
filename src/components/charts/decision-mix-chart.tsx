"use client";

import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

const COLORS: Record<string, string> = {
  ELIGIBLE: "#15803d",
  REFERRED: "#b45309",
  INELIGIBLE: "#b91c1c",
  AWAITING_INFORMATION: "#0369a1",
};

const FALLBACK = "#64748b";

const SIZE = { width: 230, height: 220 };

export interface DecisionDatum {
  decision: string;
  count: number;
}

export function DecisionMixChart({ data }: { data: DecisionDatum[] }) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <figure
      role="img"
      aria-label={`Quote decisions: ${data
        .map((item) => `${item.decision.toLowerCase().replace(/_/g, " ")} ${item.count}`)
        .join(", ")}`}
      className="flex flex-col gap-3"
    >
      {/* Fixed canvas size: Recharts measured a zero-width container on first
          paint inside the flex layout, which clipped the ring. */}
      <div className="relative mx-auto shrink-0" style={{ width: SIZE.width, height: SIZE.height }}>
        <PieChart width={SIZE.width} height={SIZE.height}>
          <Pie
            data={data}
            dataKey="count"
            nameKey="decision"
            innerRadius={62}
            outerRadius={92}
            paddingAngle={2}
            stroke="#ffffff"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((entry) => (
              <Cell key={entry.decision} fill={COLORS[entry.decision] ?? FALLBACK} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip />} />
        </PieChart>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular text-foreground">{total}</span>
          <span className="text-[11px] uppercase tracking-wide text-muted">quotes</span>
        </div>
      </div>

      <figcaption className="min-w-0">
        <ul className="space-y-2">
          {data.map((item) => (
            <li key={item.decision} className="flex items-center gap-2 text-xs">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: COLORS[item.decision] ?? FALLBACK }}
              />
              <span className="flex-1 truncate capitalize text-muted">{item.decision.toLowerCase().replace(/_/g, " ")}</span>
              <span className="font-medium tabular text-foreground">{item.count}</span>
              <span className="w-9 text-right tabular text-muted">
                {total === 0 ? "0%" : `${Math.round((item.count / total) * 100)}%`}
              </span>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}
