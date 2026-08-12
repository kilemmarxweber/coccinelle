"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortDay } from "@/components/reports/report-shell";

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#f43f5e", "#8b5cf6", "#64748b"];

export function TrendAreaChart(props: {
  data: { day: string; value: number }[];
  color?: string;
  valueLabel?: string;
}) {
  const color = props.color ?? "#0ea5e9";
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={props.data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="day"
          tickFormatter={shortDay}
          tick={{ fontSize: 11 }}
          minTickGap={24}
        />
        <YAxis tick={{ fontSize: 11 }} width={48} />
        <Tooltip
          labelFormatter={(l) => shortDay(String(l))}
          formatter={(v) => [
            typeof v === "number" ? v.toLocaleString("fr-FR") : String(v ?? ""),
            props.valueLabel ?? "Valeur",
          ]}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          fill={color}
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DualBarChart(props: {
  data: { day: string; entrees: number; sorties: number }[];
  entreesLabel?: string;
  sortiesLabel?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={props.data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="day"
          tickFormatter={shortDay}
          tick={{ fontSize: 11 }}
          minTickGap={24}
        />
        <YAxis tick={{ fontSize: 11 }} width={40} />
        <Tooltip labelFormatter={(l) => shortDay(String(l))} />
        <Legend />
        <Bar
          dataKey="entrees"
          name={props.entreesLabel ?? "Entrées"}
          fill="#10b981"
          radius={4}
        />
        <Bar
          dataKey="sorties"
          name={props.sortiesLabel ?? "Sorties"}
          fill="#f43f5e"
          radius={4}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SimpleBarChart(props: {
  data: { name: string; value: number }[];
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={props.data} layout="vertical" margin={{ left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis
          type="category"
          dataKey="name"
          width={90}
          tick={{ fontSize: 11 }}
        />
        <Tooltip />
        <Bar
          dataKey="value"
          fill={props.color ?? "#0ea5e9"}
          radius={4}
          name="Valeur"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart(props: { data: { name: string; value: number }[] }) {
  const data = props.data
    .map((d) => ({
      name: String(d.name ?? "").trim() || "Autre",
      value: Number(d.value),
    }))
    .filter((d) => Number.isFinite(d.value) && d.value > 0);

  // Fusionne les libellés identiques (évite slices dupliquées).
  const merged = new Map<string, number>();
  for (const d of data) {
    merged.set(d.name, (merged.get(d.name) ?? 0) + d.value);
  }
  const slices = [...merged.entries()].map(([name, value]) => ({ name, value }));
  const total = slices.reduce((s, d) => s + d.value, 0);

  if (slices.length === 0 || !(total > 0)) {
    return (
      <p className="flex h-full min-h-[240px] items-center justify-center text-sm text-muted-foreground">
        Aucune donnée sur la période.
      </p>
    );
  }

  // conic-gradient : fiable (pas de ResponsiveContainer / Recharts Pie).
  let acc = 0;
  const gradient = slices
    .map((d, i) => {
      const start = (acc / total) * 360;
      acc += d.value;
      const end = (acc / total) * 360;
      return `${COLORS[i % COLORS.length]} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <div className="flex h-full min-h-[240px] w-full flex-col items-center justify-center gap-4 px-2">
      <div
        className="size-36 shrink-0 rounded-full sm:size-40"
        style={{
          background: `conic-gradient(${gradient})`,
          WebkitMask:
            "radial-gradient(circle at center, transparent 48%, #000 49%)",
          mask: "radial-gradient(circle at center, transparent 48%, #000 49%)",
        }}
        aria-hidden
      />
      <ul className="flex w-full max-w-xs flex-col gap-1.5 text-xs">
        {slices.map((d, i) => {
          const pct = Math.round((d.value / total) * 1000) / 10;
          return (
            <li
              key={`${d.name}-${i}`}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                <span className="truncate font-medium">{d.name}</span>
              </span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {pct}% · {d.value.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function FinanceComboChart(props: {
  data: { day: string; revenus: number; entrees: number; sorties: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={props.data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="day"
          tickFormatter={shortDay}
          tick={{ fontSize: 11 }}
          minTickGap={24}
        />
        <YAxis tick={{ fontSize: 11 }} width={48} />
        <Tooltip labelFormatter={(l) => shortDay(String(l))} />
        <Legend />
        <Area
          type="monotone"
          dataKey="revenus"
          name="Revenus $"
          stroke="#0ea5e9"
          fill="#0ea5e9"
          fillOpacity={0.12}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="entrees"
          name="Entrées stock"
          stroke="#10b981"
          fill="#10b981"
          fillOpacity={0.08}
          strokeWidth={2}
        />
        <Area
          type="monotone"
          dataKey="sorties"
          name="Sorties stock"
          stroke="#f43f5e"
          fill="#f43f5e"
          fillOpacity={0.08}
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
