"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BedDouble,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Package,
  Plane,
  Receipt,
  ShoppingCart,
  Sparkles,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { useLiveRefresh } from "@/components/branch/use-live-refresh";
import {
  branchDashboardFingerprintAction,
  type BranchDashboardData,
  type DashboardIconKey,
} from "@/lib/branch/dashboard-actions";
import { isLegacyCaissierRole } from "@/lib/branch/ops-roles";
import { cn } from "@/lib/utils";

const ICONS: Record<DashboardIconKey, LucideIcon> = {
  wallet: Wallet,
  bed: BedDouble,
  utensils: UtensilsCrossed,
  chef: ChefHat,
  clipboard: ClipboardList,
  shopping: ShoppingCart,
  plane: Plane,
  package: Package,
  users: Users,
  activity: Activity,
  receipt: Receipt,
  calendar: CalendarDays,
};

function greeting(now: Date, name: string) {
  const h = now.getHours();
  const first = name.split(/\s+/)[0] ?? name;
  if (h < 12) return `Bonjour, ${first}`;
  if (h < 18) return `Bon après-midi, ${first}`;
  return `Bonsoir, ${first}`;
}

function dateLabel(now: Date) {
  return now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function BranchDashboard(props: {
  organizationId: string;
  branchId: string;
  data: BranchDashboardData;
  greetingText: string;
  dateText: string;
}) {
  const { data } = props;
  const [now, setNow] = useState<Date | null>(null);
  const fingerprint = useCallback(
    () =>
      branchDashboardFingerprintAction(props.organizationId, props.branchId),
    [props.organizationId, props.branchId],
  );
  useLiveRefresh(fingerprint, 12_000);

  useEffect(() => {
    setNow(new Date());
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-5 sm:px-5 lg:px-6">
      <section className="dash-fade-up rounded-lg border border-border bg-card px-5 py-6 shadow-sm sm:px-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              <span className="size-1.5 rounded-full bg-[#16a34a]" />
              Activité en direct · {data.roleLabel}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">
              {now ? greeting(now, data.userName) : props.greetingText}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
              {data.mission}
            </p>
            {isLegacyCaissierRole(data.opsRole) ? (
              <p className="mt-3 max-w-xl text-xs text-muted-foreground">
                Profil caissier legacy : choisissez « Caissier séjours » ou
                « Caissier restauration » dans l’équipe.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-1 text-sm text-muted-foreground lg:items-end">
            <p className="capitalize">{now ? dateLabel(now) : props.dateText}</p>
            <p className="font-medium text-foreground">{data.branchName}</p>
            {data.cashSessionOpen != null ? (
              <p
                className={cn(
                  "mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  data.cashSessionOpen
                    ? "bg-[#16a34a]/10 text-[#15803d]"
                    : "bg-muted text-muted-foreground",
                )}
              >
                Caisse {data.cashSessionOpen ? "ouverte" : "fermée"}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {data.kpis.length > 0 ? (
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {data.kpis.map((kpi, i) => {
            return (
              <article
                key={kpi.key}
                className="dash-fade-up rounded-lg border border-border bg-card p-4 shadow-sm"
                style={{ animationDelay: `${80 + i * 70}ms` }}
              >
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {kpi.label}
                </p>
                <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums sm:text-[1.7rem]">
                  {kpi.value}
                </p>
                <p className="mt-1.5 text-xs leading-snug text-muted-foreground">
                  {kpi.hint}
                </p>
              </article>
            );
          })}
        </section>
      ) : null}

      {data.focus.length > 0 ? (
        <section className="dash-fade-up space-y-3" style={{ animationDelay: "280ms" }}>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Priorités du moment
            </h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {data.focus.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-4 shadow-sm transition hover:border-primary/40"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-primary px-2.5 py-1 text-sm font-semibold tabular-nums text-primary-foreground">
                    {item.count}
                  </span>
                  <ArrowRight className="size-4 text-primary opacity-60 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {data.shortcuts.length > 0 ? (
        <section className="dash-fade-up space-y-3" style={{ animationDelay: "360ms" }}>
          <h2 className="text-sm font-semibold tracking-wide uppercase">
            Accès rapides
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.shortcuts.map((item) => {
              const Icon = ICONS[item.icon];
              return (
                <Link
                  key={item.href + item.title}
                  href={item.href}
                  className="group flex items-start gap-3.5 rounded-lg border border-border bg-card p-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="font-semibold text-foreground group-hover:text-primary">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
