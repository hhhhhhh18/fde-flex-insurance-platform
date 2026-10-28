"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { formatCompactCurrency } from "@/lib/format";

export interface TrendDatum {
  month: string;
  quoted: number;
  issued: number;
}

export function PremiumTrendChart({ data }: { data: TrendDatum[] }) {
  const labelled = data.map((item) => ({
    ...item,
    label: new Date(`${item.month}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }),
  }));

  return (
    <div role="img" aria-label="Monthly quoted and issued premium trend" className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={labelled} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <defs>
            <linearGradient id="quotedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1d4ed8" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="issuedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#0f766e" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickFormatter={(value: number) => formatCompactCurrency(value)} tickLine={false} axisLine={false} width={58} />
          <Tooltip content={<ChartTooltip valueFormat="currency" />} />
          <Area
            type="monotone"
            dataKey="quoted"
            name="Quoted"
            stroke="#1d4ed8"
            strokeWidth={2}
            fill="url(#quotedGradient)"
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="issued"
            name="Issued"
            stroke="#0f766e"
            strokeWidth={2}
            fill="url(#issuedGradient)"
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
