"use client";

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip } from "./chart-tooltip";

const COLORS: Record<string, string> = {
  ACTIVE: "#15803d",
  PENDING_PAYMENT: "#b45309",
  CANCELLED: "#b91c1c",
  EXPIRED: "#94a3b8",
};

export interface StatusDatum {
  status: string;
  count: number;
}

export function PolicyStatusChart({ data }: { data: StatusDatum[] }) {
  const chartData = data.map((item) => ({
    status: item.status.toLowerCase().replace(/_/g, " "),
    count: item.count,
    fill: COLORS[item.status] ?? "#64748b",
  }));

  return (
    <div
      role="img"
      aria-label={`Policy status: ${data.map((item) => `${item.status.toLowerCase().replace(/_/g, " ")} ${item.count}`).join(", ")}`}
      className="h-[240px] w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }} barCategoryGap={24}>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 3" />
          <XAxis dataKey="status" tickLine={false} axisLine={false} tickMargin={8} interval={0} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={44} />
          <Tooltip cursor={{ fill: "rgba(15,23,42,0.04)" }} content={<ChartTooltip />} />
          <Bar dataKey="count" name="Policies" radius={[6, 6, 0, 0]} maxBarSize={56} isAnimationActive={false}>
            {chartData.map((entry) => (
              <Cell key={entry.status} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
