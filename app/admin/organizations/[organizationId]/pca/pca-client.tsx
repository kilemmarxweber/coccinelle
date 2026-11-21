"use client";

import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { DonutChart, TrendAreaChart } from "@/components/reports/report-charts";
import { formatMoney } from "@/components/reports/report-shell";
import {
  PilotageFrame,
  PilotageKpis,
  PilotageTable,
} from "@/components/org/pilotage-frame";
import { PcaPeriodPicker } from "./pca-period-picker";
import {
  exportOrgReportExcel,
  exportOrgReportPdf,
} from "@/lib/org/report-exports";
import { cn } from "@/lib/utils";

type Dept = {
  id: string;
  name: string;
  code: string;
  salesDayUsd: number;
  salesMonthUsd: number;
  expensesMonthUsd: number;
  creditsOpenUsd: number;
  cmvUsd: number;
  marginUsd: number;
  resultUsd: number;
  vsTargetPct: number | null;
};

type DayPoint = { day: string; ventes: number; charges: number };

type TrendStyle = "area" | "bar";

type Props = {
  organizationId: string;
  orgName: string;
  data: {
    view: "jour" | "jours" | "mois" | "annee";
    year: number;
    month: number;
    day: number;
    span: number;
    reportKind: string;
    from: string;
    to: string;
    periodLabel: string;
    rangeLabel: string;
    dayKpiLabel: string;
    periodKpiLabel: string;
    periodColumnLabel: string;
    seriesGrain: "jour" | "mois";
    includesToday: boolean;
    todayYear: number;
    todayMonth: number;
    todayDay: number;
    salesDay: number;
    salesMonth: number;
    cmvMonth: number;
    marginMonth: number;
    expensesMonth: number;
    resultMonth: number;
    creditsOpen: number;
    toRemit: number;
    vsTargetPctTotal: number | null;
    alerts: { kind: string; label: string }[];
    departments: Dept[];
    series: DayPoint[];
  };
};

const ALERT_KIND: Record<string, string> = {
  caisse: "Caisse",
  versement: "Versement",
  achat: "Achat",
  correction: "Correction",
};

const MONTH_TICKS = [
  "janv.",
  "févr.",
  "mars",
  "avr.",
  "mai",
  "juin",
  "juil.",
  "août",
  "sept.",
  "oct.",
  "nov.",
  "déc.",
];

function TargetBadge({ pct }: { pct: number | null }) {
  if (pct == null) return "—";
  return (
    <Badge
      variant={pct >= 100 ? "default" : "secondary"}
      className={cn(pct > 100 && "bg-emerald-600 text-white hover:bg-emerald-600")}
    >
      {pct} %
    </Badge>
  );
}

export function PcaClient({ organizationId, orgName, data }: Props) {
  const [trendStyle, setTrendStyle] = useState<TrendStyle>("area");

  const mix = useMemo(
    () =>
      data.departments.map((d) => ({
        name: d.name,
        value: d.salesMonthUsd,
      })),
    [data.departments],
  );

  const dailyArea = useMemo(
    () => data.series.map((p) => ({ day: p.day, value: p.ventes })),
    [data.series],
  );

  const monthTick = (iso: string) => {
    const month = Number(iso.slice(5, 7));
    return MONTH_TICKS[month - 1] ?? iso;
  };

  function handleExport(kind: "pdf" | "excel") {
    const meta = {
      orgName,
      reportTitle: `Tableau de bord PCA — ${data.periodLabel}`,
      from: data.from,
      to: data.to,
      branchNames: data.departments.map((d) => d.name),
      kpis: [
        { label: data.dayKpiLabel, value: formatMoney(data.salesDay) },
        { label: data.periodKpiLabel, value: formatMoney(data.salesMonth) },
        { label: "CMV", value: formatMoney(data.cmvMonth) },
        { label: "Marge", value: formatMoney(data.marginMonth) },
        { label: "Charges", value: formatMoney(data.expensesMonth) },
        { label: "Résultat", value: formatMoney(data.resultMonth) },
        { label: "À verser", value: formatMoney(data.toRemit) },
        { label: "Créances", value: formatMoney(data.creditsOpen) },
        { label: "Alertes", value: String(data.alerts.length) },
        {
          label: "Objectif",
          value:
            data.vsTargetPctTotal == null ? "—" : `${data.vsTargetPctTotal} %`,
        },
      ],
    };
    const departmentsTable = {
      title: "Départements",
      headers: [
        "Département",
        "Code",
        "Jour USD",
        `${data.periodColumnLabel} USD`,
        "CMV",
        "Marge",
        "Charges",
        "Résultat",
        "Créances",
        "Objectif %",
      ],
      rows: data.departments.map((d) => [
        d.name,
        d.code,
        d.salesDayUsd,
        d.salesMonthUsd,
        d.cmvUsd,
        d.marginUsd,
        d.expensesMonthUsd,
        d.resultUsd,
        d.creditsOpenUsd,
        d.vsTargetPct ?? "—",
      ]),
    };
    const extras = [
      {
        title: "Tendance quotidienne",
        headers: [
          data.seriesGrain === "mois" ? "Mois" : "Jour",
          "Ventes USD",
          "Charges USD",
        ],
        rows: data.series.map((p) => [p.day, p.ventes, p.charges]),
      },
      {
        title: "Alertes",
        headers: ["Type", "Détail"],
        rows: data.alerts.map((a) => [ALERT_KIND[a.kind] ?? a.kind, a.label]),
      },
    ];
    const ok =
      kind === "pdf"
        ? exportOrgReportPdf(meta, departmentsTable, extras)
        : exportOrgReportExcel(meta, departmentsTable, extras);
    if (!ok && kind === "pdf") {
      toast.error("Autorisez les fenêtres popup pour l’export PDF.");
      return;
    }
    toast.success(
      kind === "pdf" ? "PDF prêt à imprimer" : "Fichier Excel téléchargé",
    );
  }

  return (
    <PilotageFrame
      backHref={`/admin/organizations/${organizationId}`}
      kicker="Tableau de bord direction"
      title={orgName}
      subtitle={
        data.periodLabel === data.rangeLabel
          ? `${data.reportKind} · ${data.periodLabel}. Le PDF et l’Excel reprennent cette période.`
          : `${data.periodLabel} · ${data.rangeLabel}. Le PDF et l’Excel reprennent cette période.`
      }
      onPdf={() => handleExport("pdf")}
      onExcel={() => handleExport("excel")}
    >
      <PcaPeriodPicker
        view={data.view}
        year={data.year}
        month={data.month}
        day={data.day}
        span={data.span}
        periodLabel={data.periodLabel}
        rangeLabel={data.rangeLabel}
        reportKind={data.reportKind}
        todayYear={data.todayYear}
        todayMonth={data.todayMonth}
        todayDay={data.todayDay}
      />

      <PilotageKpis
        items={[
          { label: data.dayKpiLabel, value: formatMoney(data.salesDay) },
          { label: data.periodKpiLabel, value: formatMoney(data.salesMonth) },
          {
            label: "Résultat",
            value: formatMoney(data.resultMonth),
            hint: `Marge ${formatMoney(data.marginMonth)}`,
          },
          {
            label: "À verser",
            value: formatMoney(data.toRemit),
            hint: `${data.alerts.length} alerte${data.alerts.length > 1 ? "s" : ""}`,
            tone: data.alerts.length ? "alert" : "green",
          },
        ]}
      />

      <section className="grid min-h-0 shrink-0 gap-3 lg:h-[220px] lg:grid-cols-5">
        <article className="flex min-h-0 flex-col rounded-xl border border-border bg-card p-3 shadow-sm lg:col-span-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Tendance des ventes</h2>
            <div className="flex rounded-full bg-muted p-0.5 text-[11px]">
              {(
                [
                  ["area", "Courbe"],
                  ["bar", "Charges"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    "rounded-full px-2 py-0.5 font-medium",
                    trendStyle === id
                      ? "bg-[#1b9a4b] text-white"
                      : "text-muted-foreground",
                  )}
                  onClick={() => setTrendStyle(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <TrendAreaChart
              data={
                trendStyle === "area"
                  ? dailyArea
                  : data.series.map((p) => ({ day: p.day, value: p.charges }))
              }
              color={trendStyle === "area" ? "#1b9a4b" : "#f59e0b"}
              valueLabel={trendStyle === "area" ? "Ventes" : "Charges"}
              tickFormatter={
                data.seriesGrain === "mois" ? monthTick : undefined
              }
            />
          </div>
        </article>
        <article className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm lg:col-span-2">
          <h2 className="mb-2 shrink-0 text-sm font-semibold">
            CA par département
          </h2>
          <div className="min-h-0 flex-1">
            <DonutChart data={mix} compact />
          </div>
        </article>
      </section>

      {data.alerts.length > 0 ? (
        <p className="flex shrink-0 items-center gap-2 rounded-lg border border-[#ffe0c2] bg-[#fff8f1] px-3 py-2 text-xs text-[#c2410c]">
          <AlertTriangle className="size-3.5 shrink-0" />
          <span className="truncate">
            {data.alerts
              .slice(0, 3)
              .map((a) => `${ALERT_KIND[a.kind] ?? a.kind} · ${a.label}`)
              .join("  ·  ")}
          </span>
        </p>
      ) : null}

      <PilotageTable
        className="min-h-56 shrink-0"
        title="Départements"
        headers={[
          "Département",
          data.includesToday ? "Jour" : "Dernier jour",
          data.periodColumnLabel,
          "CMV",
          "Marge",
          "Charges",
          "Résultat",
          "Créances",
          "Objectif",
        ]}
      >
        {data.departments.map((d) => (
          <tr key={d.id}>
            <td className="font-medium">
              {d.name}{" "}
              <span className="font-mono text-xs text-muted-foreground">
                {d.code}
              </span>
            </td>
            <td className="tabular-nums">{formatMoney(d.salesDayUsd)}</td>
            <td className="tabular-nums">{formatMoney(d.salesMonthUsd)}</td>
            <td className="tabular-nums">{formatMoney(d.cmvUsd)}</td>
            <td className="tabular-nums">{formatMoney(d.marginUsd)}</td>
            <td className="tabular-nums">{formatMoney(d.expensesMonthUsd)}</td>
            <td className="tabular-nums">{formatMoney(d.resultUsd)}</td>
            <td className="tabular-nums">{formatMoney(d.creditsOpenUsd)}</td>
            <td>
              <TargetBadge pct={d.vsTargetPct} />
            </td>
          </tr>
        ))}
        <tr className="bg-[#f3fbf6] font-semibold">
          <td>Total</td>
          <td className="tabular-nums">{formatMoney(data.salesDay)}</td>
          <td className="tabular-nums">{formatMoney(data.salesMonth)}</td>
          <td className="tabular-nums">{formatMoney(data.cmvMonth)}</td>
          <td className="tabular-nums">{formatMoney(data.marginMonth)}</td>
          <td className="tabular-nums">{formatMoney(data.expensesMonth)}</td>
          <td className="tabular-nums">{formatMoney(data.resultMonth)}</td>
          <td className="tabular-nums">{formatMoney(data.creditsOpen)}</td>
          <td>
            <TargetBadge pct={data.vsTargetPctTotal} />
          </td>
        </tr>
      </PilotageTable>
    </PilotageFrame>
  );
}
