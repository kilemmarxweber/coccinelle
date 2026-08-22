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
  type DashboardTone,
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

const TONE: Record<DashboardTone, { wrap: string; value: string; icon: string }> = {
  primary: {
    wrap: "from-primary/12 via-card to-card",
    value: "text-primary",
    icon: "bg-primary/12 text-primary",
  },
  emerald: {
    wrap: "from-emerald-500/12 via-card to-card",
    value: "text-emerald-700 dark:text-emerald-400",
    icon: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  },
  amber: {
    wrap: "from-amber-500/14 via-card to-card",
    value: "text-amber-700 dark:text-amber-400",
    icon: "bg-amber-500/12 text-amber-700 dark:text-amber-400",
  },
  sky: {
    wrap: "from-sky-500/12 via-card to-card",
    value: "text-sky-700 dark:text-sky-400",
    icon: "bg-sky-500/12 text-sky-700 dark:text-sky-400",
  },
  rose: {
    wrap: "from-rose-500/12 via-card to-card",
    value: "text-rose-700 dark:text-rose-400",
    icon: "bg-rose-500/12 text-rose-700 dark:text-rose-400",
  },
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
      <section className="dash-fade-up relative overflow-hidden rounded-3xl bg-primary px-5 py-6 text-primary-foreground shadow-lg sm:px-8 sm:py-8">
        <div className="dash-orb pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/15 blur-2xl" />
        <div
          className="dash-orb pointer-events-none absolute -bottom-20 left-10 size-48 rounded-full bg-black/20 blur-2xl"
          style={{ animationDelay: "1.4s" }}
        />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium tracking-wide uppercase">
              <span className="dash-pulse size-1.5 rounded-full bg-emerald-300" />
              Activité en direct · {data.roleLabel}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {now ? greeting(now, data.userName) : props.greetingText}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-[15px]">
              {data.mission}
            </p>
            {isLegacyCaissierRole(data.opsRole) ? (
              <p className="mt-3 max-w-xl text-xs text-amber-100/90">
                Profil caissier legacy : choisissez « Caissier séjours » ou
                « Caissier restauration » dans l’équipe.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-1 text-sm text-white/80 lg:items-end">
            <p className="capitalize">{now ? dateLabel(now) : props.dateText}</p>
            <p className="font-medium text-white">{data.branchName}</p>
            {data.cashSessionOpen != null ? (
              <p
                className={cn(
                  "mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  data.cashSessionOpen
                    ? "bg-emerald-400/20 text-emerald-100"
                    : "bg-white/10 text-white/80",
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
            const tone = TONE[kpi.tone];
            return (
              <article
                key={kpi.key}
                className={cn(
                  "dash-fade-up rounded-2xl border border-border bg-gradient-to-br p-4 shadow-sm",
                  tone.wrap,
                )}
                style={{ animationDelay: `${80 + i * 70}ms` }}
              >
                <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {kpi.label}
                </p>
                <p
                  className={cn(
                    "mt-2 text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.7rem]",
                    tone.value,
                  )}
                >
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
                className="group flex items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/10"
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
                  className="group flex items-start gap-3.5 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-md"
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
