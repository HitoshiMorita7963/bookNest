"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatNumber } from "@/lib/utils";

const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" };

interface TipProps {
  active?: boolean;
  payload?: readonly { value?: unknown }[];
  label?: unknown;
  unit: string;
}

function ChartTooltip({ active, payload, label, unit }: TipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="text-xs text-muted-foreground">{String(label ?? "")}</p>
      <p className="font-semibold tabular-nums">
        {formatNumber(Number(payload[0].value ?? 0))}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  );
}

/** 単一系列の縦棒グラフ（月別冊数・月別ページ数など） */
export function ColumnChart({
  data,
  xKey,
  yKey,
  unit,
  label,
  height = 220,
}: {
  data: Record<string, string | number>[];
  xKey: string;
  yKey: string;
  unit: string;
  label: string;
  height?: number;
}) {
  return (
    <figure aria-label={label}>
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis dataKey={xKey} tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} width={44} />
            <Tooltip cursor={{ fill: "var(--muted)", opacity: 0.6 }} content={(p) => <ChartTooltip active={p.active} payload={p.payload} label={p.label} unit={unit} />} />
            <Bar dataKey={yKey} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{label}</figcaption>
    </figure>
  );
}

/** 横棒グラフ（ジャンル別・評価分布）。ラベルと値を直接表示する */
export function BarList({ data, unit, max }: { data: { name: string; value: number }[]; unit: string; max?: number }) {
  const m = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="space-y-2.5">
      {data.map((d) => (
        <li key={d.name} className="grid grid-cols-[5.5rem_1fr_3rem] items-center gap-2 text-sm" title={`${d.name}: ${d.value}${unit}`}>
          <span className="truncate text-foreground/85">{d.name}</span>
          <span className="h-3 overflow-hidden rounded-full bg-muted">
            <span className="block h-full rounded-full bg-[var(--chart-1)]" style={{ width: `${(d.value / m) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-muted-foreground">
            {d.value}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}
