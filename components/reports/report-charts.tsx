"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
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
        <Bar dataKey="entrees" name="Entrées" fill="#10b981" radius={4} />
        <Bar dataKey="sorties" name="Sorties" fill="#f43f5e" radius={4} />
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
  const data = props.data.filter((d) => d.value > 0);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={55}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) =>
            typeof v === "number" ? v.toLocaleString("fr-FR") : String(v ?? "")
          }
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
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
