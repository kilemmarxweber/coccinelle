"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatBothAmounts } from "@/lib/cash/exchange";
import { defaultReportRange, toIsoDate } from "@/lib/hotel/reports/period";

export function ReportShell(props: {
  title: string;
  subtitle: string;
  organizationId: string;
  branchId: string;
  from: string;
  to: string;
  basePath: string;
  children: ReactNode;
  onExportPdf?: () => void;
  /** Bandeau taux : toujours les deux sens USD↔CDF. */
  rateBanner?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [from, setFrom] = useState(props.from);
  const [to, setTo] = useState(props.to);

  function apply(nextFrom = from, nextTo = to) {
    const qs = new URLSearchParams({ from: nextFrom, to: nextTo });
    start(() => {
      router.push(`${props.basePath}?${qs.toString()}`);
    });
  }

  function preset(days: number) {
    const range = defaultReportRange(days);
    setFrom(range.from);
    setTo(range.to);
    apply(range.from, range.to);
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-5 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{props.title}</h1>
          <p className="text-sm text-muted-foreground">{props.subtitle}</p>
          {props.rateBanner ? (
            <p className="mt-1 text-xs font-medium text-sky-700 dark:text-sky-300">
              {props.rateBanner}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {props.onExportPdf ? (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              onClick={props.onExportPdf}
            >
              <FileDown className="size-4" />
              PDF
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap gap-1.5">
          {[
            [7, "7 jours"],
            [30, "30 jours"],
            [90, "90 jours"],
          ].map(([d, label]) => (
            <button
              key={String(d)}
              type="button"
              onClick={() => preset(Number(d))}
              className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/80"
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const t = toIsoDate(new Date());
              setFrom(t);
              setTo(t);
              apply(t, t);
            }}
            className="rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted/80"
          >
            Aujourd’hui
          </button>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="grid gap-1.5">
            <Label htmlFor="rep-from">Du</Label>
            <Input
              id="rep-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rep-to">Au</Label>
            <Input
              id="rep-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button type="button" disabled={pending} onClick={() => apply()}>
            Appliquer
          </Button>
          <p className="text-xs text-muted-foreground sm:ml-auto sm:self-center">
            Comparaison auto vs période précédente de même durée
          </p>
        </div>
      </div>

      {props.children}
    </div>
  );
}

export function KpiGrid(props: {
  items: {
    label: string;
    value: string;
    delta?: number | null;
    hint?: string;
  }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {props.items.map((k) => (
        <div
          key={k.label}
          className="rounded-2xl border border-border bg-card p-4 shadow-sm"
        >
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {k.label}
          </p>
          <p className="mt-2 text-xl font-bold tabular-nums leading-snug sm:text-2xl">
            {k.value}
          </p>
          {typeof k.delta === "number" ? (
            <p
              className={cn(
                "mt-1 flex items-center gap-1 text-xs font-medium",
                k.delta > 0
                  ? "text-emerald-600"
                  : k.delta < 0
                    ? "text-rose-600"
                    : "text-muted-foreground",
              )}
            >
              {k.delta > 0 ? (
                <ArrowUpRight className="size-3.5" />
              ) : k.delta < 0 ? (
                <ArrowDownRight className="size-3.5" />
              ) : null}
              {k.delta > 0 ? "+" : ""}
              {k.delta}% vs période préc.
            </p>
          ) : null}
          {k.hint ? (
            <p className="mt-1 text-[11px] text-muted-foreground">{k.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function ChartCard(props: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-card p-4 shadow-sm",
        props.className,
      )}
    >
      <div className="mb-3">
        <h2 className="text-sm font-semibold">{props.title}</h2>
        {props.description ? (
          <p className="text-xs text-muted-foreground">{props.description}</p>
        ) : null}
      </div>
      <div className="h-64 w-full min-w-0">{props.children}</div>
    </div>
  );
}

export function ReportsNav(props: {
  organizationId: string;
  branchId: string;
  active: "ventes" | "achats" | "articles" | "financier" | "tableauBord";
}) {
  const base = `/admin/organizations/${props.organizationId}/branches/${props.branchId}/rapports`;
  const items = [
    { id: "tableauBord", href: `${base}/tableau-bord`, label: "Tableau de bord" },
    { id: "ventes", href: `${base}/ventes`, label: "Ventes" },
    { id: "achats", href: `${base}/achats`, label: "Achats" },
    { id: "articles", href: `${base}/articles`, label: "Articles" },
    { id: "financier", href: `${base}/financier`, label: "Financier" },
  ] as const;

  return (
    <nav className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition",
            props.active === item.id
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function formatMoney(
  amountUsd: number,
  rate?: {
    rate: number;
    configuredFrom?: string;
  } | null,
) {
  if (rate && rate.rate > 0) {
    return formatBothAmounts(amountUsd, {
      rate: rate.rate,
      configuredFrom: rate.configuredFrom ?? "USD",
    });
  }
  return `${amountUsd.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} $`;
}

export function formatQty(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

export function shortDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  });
}
