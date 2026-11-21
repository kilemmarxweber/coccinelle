"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Package,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import { TrendAreaChart } from "@/components/reports/report-charts";
import {
  boutiqueRoutes,
  branchCaissePath,
  sharedBranchRoutes,
} from "@/lib/branch/paths";
import type { DepartmentOverview } from "@/lib/branch/department-overview";
import { cn } from "@/lib/utils";

type RangeKey = "d7" | "d30" | "month";

const PAY_COLORS = ["#1b9a4b", "#f59e0b", "#3b82f6", "#0e6b3c"];

function delta(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function money(usd: number) {
  return `${usd.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $`;
}

function cdf(usd: number, rate: number | null) {
  if (!rate) return null;
  return `${Math.round(usd * rate).toLocaleString("fr-FR")} CDF`;
}

function PayDonut(props: { data: { name: string; value: number }[] }) {
  const total = props.data.reduce((sum, slice) => sum + slice.value, 0);
  let acc = 0;
  const gradient =
    total > 0
      ? props.data
          .map((slice, index) => {
            const start = (acc / total) * 360;
            acc += slice.value;
            const end = (acc / total) * 360;
            return `${PAY_COLORS[index % PAY_COLORS.length]} ${start}deg ${end}deg`;
          })
          .join(", ")
      : "#e9ecef 0deg 360deg";

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 sm:flex-row sm:items-center">
      <div className="relative grid size-36 place-items-center">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(${gradient})`,
            WebkitMask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
            mask: "radial-gradient(circle at center, transparent 58%, #000 59%)",
          }}
        />
        <div className="text-center">
          <p className="text-lg font-semibold tabular-nums">
            {total > 0 ? "100%" : "0%"}
          </p>
          <p className="text-[11px] text-muted-foreground">Total</p>
        </div>
      </div>
      <ul className="w-full max-w-xs space-y-2 text-xs">
        {props.data.map((slice, index) => {
          const pct = total > 0 ? Math.round((slice.value / total) * 100) : 0;
          return (
            <li key={slice.name} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: PAY_COLORS[index % PAY_COLORS.length] }}
                />
                <span className="truncate">{slice.name}</span>
              </span>
              <span className="shrink-0 text-right tabular-nums text-muted-foreground">
                {pct}%
                <span className="block text-[10px]">{money(slice.value)}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function DepartmentDashboard(props: {
  organizationId: string;
  branchId: string;
  overview: DepartmentOverview;
}) {
  const { overview } = props;
  const [range, setRange] = useState<RangeKey>("d7");
  const [query, setQuery] = useState("");
  const salesDelta = delta(overview.salesToday, overview.salesYesterday);
  const txDelta = delta(overview.txToday, overview.txYesterday);
  const cdfToday = cdf(overview.salesToday, overview.rate);
  const cdfRemit = cdf(overview.toRemit, overview.rate);

  const activity = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return overview.activity;
    return overview.activity.filter(
      (row) =>
        row.ticket.toLowerCase().includes(q) ||
        row.cashier.toLowerCase().includes(q),
    );
  }, [overview.activity, query]);

  const ventesHref = boutiqueRoutes.ventes(props.organizationId, props.branchId);
  const stockHref = boutiqueRoutes.stock(props.organizationId, props.branchId);
  const caisseHref = branchCaissePath(props.organizationId, props.branchId);

  return (
    <div className="mx-auto flex h-[calc(100svh-4rem)] max-h-[calc(100svh-4rem)] w-full max-w-7xl flex-col gap-3 overflow-hidden px-3 py-3 sm:px-5">
      <div className="flex shrink-0 flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vue d&apos;ensemble</h1>
          <p className="text-sm text-muted-foreground">
            Suivi de l&apos;activité du département
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Référence ou vendeur…"
            className="h-9 w-full rounded-full border border-border bg-card px-3 text-sm outline-none focus:border-primary sm:w-64"
          />
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#1b9a4b]/25 bg-[#e9f7ef] px-3 py-1.5 text-xs font-medium text-[#157a3c]">
            <CheckCircle2 className="size-3.5" />
            Synchronisé
          </span>
        </div>
      </div>

      <section className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={ShoppingCart}
          tone="green"
          label="Ventes du jour"
          value={money(overview.salesToday)}
          hint={cdfToday ?? undefined}
          delta={salesDelta}
        />
        <Kpi
          icon={Wallet}
          tone="green"
          label="Transactions"
          value={String(overview.txToday)}
          hint="Tickets encaissés aujourd'hui"
          delta={txDelta}
        />
        <Kpi
          icon={AlertTriangle}
          tone="alert"
          label="Stock à surveiller"
          value={`${overview.lowStockCount} article${overview.lowStockCount === 1 ? "" : "s"}`}
          hint="Quantité à 5 ou moins"
          href={stockHref}
        />
        <Kpi
          icon={Banknote}
          tone="green"
          label="À verser"
          value={money(overview.toRemit)}
          hint={cdfRemit ?? "Caisse du département"}
          href={sharedBranchRoutes.versements(props.organizationId, props.branchId)}
        />
      </section>

      <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-5">
        <article className="flex min-h-0 flex-col rounded-xl border border-border bg-card p-3 shadow-sm xl:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Évolution des ventes</h2>
            <div className="flex rounded-full bg-muted p-0.5 text-xs">
              {(
                [
                  ["d7", "7 jours"],
                  ["d30", "30 jours"],
                  ["month", "Mois"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setRange(id)}
                  className={cn(
                    "rounded-full px-2.5 py-1 font-medium",
                    range === id
                      ? "bg-[#1b9a4b] text-white"
                      : "text-muted-foreground",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1">
            <TrendAreaChart
              data={overview.series[range]}
              color="#1b9a4b"
              valueLabel="Ventes $"
            />
          </div>
        </article>
        <article className="flex min-h-0 flex-col rounded-xl border border-border bg-card p-3 shadow-sm xl:col-span-2">
          <h2 className="text-sm font-semibold">Répartition des paiements</h2>
          <p className="text-xs text-muted-foreground">Même période que la courbe</p>
          <div className="min-h-0 flex-1">
            <PayDonut data={overview.payments[range]} />
          </div>
        </article>
      </section>

      <section className="grid min-h-0 flex-1 gap-3 xl:grid-cols-5">
        <article className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm xl:col-span-3">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold">Activité récente</h2>
            <Link href={ventesHref} className="text-xs font-medium text-primary">
              Voir tout
            </Link>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr className="border-y border-border">
                  <th className="px-4 py-2 font-medium">Heure</th>
                  <th className="px-2 py-2 font-medium">Référence</th>
                  <th className="px-2 py-2 font-medium">Vendeur</th>
                  <th className="px-2 py-2 font-medium">Montant</th>
                  <th className="px-4 py-2 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody>
                {activity.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Aucun ticket encaissé sur la période chargée.
                    </td>
                  </tr>
                ) : (
                  activity.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2.5 tabular-nums text-muted-foreground">
                        {new Date(row.at).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Africa/Kinshasa",
                        })}
                      </td>
                      <td className="px-2 py-2.5 font-medium">{row.ticket}</td>
                      <td className="px-2 py-2.5">{row.cashier}</td>
                      <td className="px-2 py-2.5 tabular-nums">{money(row.amount)}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f7ef] px-2 py-0.5 text-[11px] font-medium text-[#157a3c]">
                          <CheckCircle2 className="size-3" />
                          Encaissée
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="min-h-0 overflow-auto rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Alertes stock</h2>
            <Link href={stockHref} className="text-xs font-medium text-primary">
              Voir tout
            </Link>
          </div>
          {overview.alerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun article sous le seuil.
            </p>
          ) : (
            <ul className="space-y-2">
              {overview.alerts.map((item) => {
                const level = item.qty <= 0 ? "Rupture" : item.qty <= 2 ? "Très faible" : "Faible";
                return (
                  <li key={item.id} className="flex items-center gap-2">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#f97316]/10 text-[#f97316]">
                      <Package className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="text-[11px] text-muted-foreground">Stock : {item.qty}</span>
                    </span>
                    <span className="rounded-full bg-[#f97316]/10 px-2 py-0.5 text-[10px] font-semibold text-[#c2410c]">
                      {level}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </article>

        <article className="min-h-0 overflow-auto rounded-xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Caisse départementale</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Fond + mouvements</dt>
              <dd className="font-medium tabular-nums">{money(overview.cash.floatAndMovements)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Montant déclaré</dt>
              <dd className="font-medium tabular-nums">
                {overview.cash.declared == null ? "—" : money(overview.cash.declared)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-lg bg-[#f97316]/10 px-2 py-1.5">
              <dt className="text-[#c2410c]">Écart</dt>
              <dd className="font-semibold tabular-nums text-[#c2410c]">
                {overview.cash.gap == null ? "—" : money(overview.cash.gap)}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {overview.cash.open ? "Session ouverte" : "Aucune session ouverte"}
          </p>
          <Link
            href={caisseHref}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#1b9a4b] text-sm font-medium text-white hover:bg-[#157a3c]"
          >
            <ArrowUpRight className="size-4" />
            Préparer le versement
          </Link>
        </article>
      </section>
    </div>
  );
}

function Kpi(props: {
  icon: typeof ShoppingCart;
  tone: "green" | "alert";
  label: string;
  value: string;
  hint?: string;
  delta?: number;
  href?: string;
}) {
  const Icon = props.icon;
  const tone =
    props.tone === "alert"
      ? "bg-[#fff4e8] text-[#f97316]"
      : "bg-[#e9f7ef] text-[#1b9a4b]";
  const body = (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border p-3 shadow-sm",
        props.tone === "alert"
          ? "border-[#ffe0c2] bg-[#fff8f1]"
          : "border-[#d7f0e1] bg-[#f3fbf6]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">{props.label}</p>
        <span className={cn("flex size-9 items-center justify-center rounded-full", tone)}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{props.value}</p>
      {props.delta != null ? (
        <p className={cn("mt-1 text-xs font-medium", props.delta >= 0 ? "text-[#157a3c]" : "text-[#c2410c]")}>
          {props.delta > 0 ? "+" : ""}
          {props.delta}% vs hier
        </p>
      ) : null}
      {props.hint ? <p className="mt-1 text-xs text-muted-foreground">{props.hint}</p> : null}
    </article>
  );
  if (!props.href) return body;
  return (
    <Link href={props.href} className="block h-full transition hover:border-primary">
      {body}
    </Link>
  );
}
