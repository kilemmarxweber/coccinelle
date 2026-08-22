"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Droplets,
  Factory,
  FileText,
  Handshake,
  Package,
  ShoppingCart,
  Sparkles,
  Wallet,
  Wine,
} from "lucide-react";
import { useLiveRefresh } from "@/components/branch/use-live-refresh";
import {
  DashboardMenuCard,
  DashboardSection,
} from "@/components/ui/dashboard-menu-card";
import { visibleMenuSectionsForBranch } from "@/lib/branch/branch-menus";
import {
  branchDashboardFingerprintAction,
  type BranchDashboardData,
  type DashboardTone,
} from "@/lib/branch/dashboard-actions";
import { canSeeDashCard, DASH_CARD, OPS_ROLE } from "@/lib/branch/ops-roles";
import { sharedBranchRoutes, usineRoutes } from "@/lib/branch/paths";
import { cn } from "@/lib/utils";

const TONE: Record<DashboardTone, { wrap: string; value: string }> = {
  primary: {
    wrap: "from-primary/12 via-card to-card",
    value: "text-primary",
  },
  emerald: {
    wrap: "from-emerald-500/12 via-card to-card",
    value: "text-emerald-700 dark:text-emerald-400",
  },
  amber: {
    wrap: "from-amber-500/14 via-card to-card",
    value: "text-amber-700 dark:text-amber-400",
  },
  sky: {
    wrap: "from-sky-500/12 via-card to-card",
    value: "text-sky-700 dark:text-sky-400",
  },
  rose: {
    wrap: "from-rose-500/12 via-card to-card",
    value: "text-rose-700 dark:text-rose-400",
  },
};

type FlowStep = {
  cardId: string;
  title: string;
  explanation: string;
  href: string;
  icon: LucideIcon;
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

function factoryModules(hasEau: boolean, hasVin: boolean) {
  const parts: string[] = [];
  if (hasEau) parts.push("Eau");
  if (hasVin) parts.push("Vins");
  return parts.length > 0 ? parts.join(" · ") : "Production";
}

function factoryFlow(args: {
  organizationId: string;
  branchId: string;
  isMarketer: boolean;
}): FlowStep[] {
  const { organizationId: org, branchId } = args;
  if (args.isMarketer) {
    return [
      {
        cardId: DASH_CARD.SERVICE_STOCK,
        title: "Float marketeur",
        explanation:
          "Vous vendez uniquement depuis votre stock auxiliaire. Le dépôt production n’est pas accessible.",
        href: usineRoutes.serviceStock(org, branchId),
        icon: ClipboardList,
      },
      {
        cardId: DASH_CARD.POS,
        title: "Vente cash",
        explanation:
          "Panier → caisse ouverte. La quantité sort de votre float tout de suite.",
        href: usineRoutes.pos(org, branchId),
        icon: ShoppingCart,
      },
      {
        cardId: DASH_CARD.USINE_CREDITS,
        title: "Vente à crédit",
        explanation:
          "Client nommé (tél. obligatoire) → quantité → échéance → document à signer. WhatsApp part ensuite.",
        href: usineRoutes.creditNew(org, branchId),
        icon: FileText,
      },
      {
        cardId: DASH_CARD.USINE_CREDITS,
        title: "Encaisser",
        explanation:
          "Acompte, puis complément(s), puis solde. Le restant reste visible jusqu’à clôture.",
        href: usineRoutes.credits(org, branchId),
        icon: Wallet,
      },
      {
        cardId: DASH_CARD.USINE_RESERVATIONS,
        title: "Réserver",
        explanation:
          "Tout client usine peut bloquer du float libre — même avec un crédit encore ouvert.",
        href: usineRoutes.reservations(org, branchId),
        icon: CalendarDays,
      },
    ];
  }
  return [
    {
      cardId: DASH_CARD.USINE_FOURNISSEURS,
      title: "Fournisseur",
      explanation:
        "Chaque achat part d’une fiche enregistrée. Pas de nom tapé une fois sur le bon.",
      href: usineRoutes.fournisseurs(org, branchId),
      icon: Handshake,
    },
    {
      cardId: DASH_CARD.BONS_COMMANDE,
      title: "Bon de commande",
      explanation:
        "Seule porte d’entrée au dépôt : consommables (et finis exceptionnels) après validation.",
      href: sharedBranchRoutes.bonsCommande(org, branchId),
      icon: FileText,
    },
    {
      cardId: DASH_CARD.USINE_DEPOT,
      title: "Dépôt",
      explanation:
        "Deux zones : consommables (intrants) et production (eau, vins, casiers).",
      href: usineRoutes.depot(org, branchId),
      icon: Package,
    },
    {
      cardId: DASH_CARD.USINE_PRODUCTION,
      title: "Production",
      explanation:
        "Recette → lot validé : les consommables sortent, les produits finis entrent. Rien n’apparaît « à la main ».",
      href: usineRoutes.production(org, branchId),
      icon: Factory,
    },
    {
      cardId: DASH_CARD.SERVICE_STOCK,
      title: "Float marketeur",
      explanation:
        "Le gérant attribue depuis le dépôt production. Le marketeur ne puise jamais dans le dépôt.",
      href: usineRoutes.serviceStock(org, branchId),
      icon: ClipboardList,
    },
    {
      cardId: DASH_CARD.POS,
      title: "Vente",
      explanation:
        "Cash (panier + caisse) ou crédit (client, document, échéance). Les deux débitent le float.",
      href: usineRoutes.pos(org, branchId),
      icon: ShoppingCart,
    },
  ];
}

export function UsineDashboard(props: {
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

  const isMarketer = data.opsRole === OPS_ROLE.MARKETEUR;
  const modules = factoryModules(data.hasEau, data.hasVin);
  const allowed = data.allowedCardIds;
  const allowedSet = useMemo(
    () => (allowed === "ALL" ? ("ALL" as const) : new Set(allowed)),
    [allowed],
  );

  const steps = useMemo(() => {
    const raw = factoryFlow({
      organizationId: props.organizationId,
      branchId: props.branchId,
      isMarketer,
    });
    return raw.filter((step) =>
      canSeeDashCard(data.opsRole, step.cardId, allowedSet),
    );
  }, [
    allowedSet,
    data.opsRole,
    isMarketer,
    props.branchId,
    props.organizationId,
  ]);

  const sections = useMemo(() => {
    if (data.opsRole === OPS_ROLE.PROPRIETAIRE) return [];
    return visibleMenuSectionsForBranch(
      props.organizationId,
      props.branchId,
      "USINE",
      {},
      data.opsRole,
      allowed,
    );
  }, [allowed, data.opsRole, props.branchId, props.organizationId]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-3 py-5 sm:px-5 lg:px-6">
      <section className="dash-fade-up relative overflow-hidden rounded-3xl bg-primary px-5 py-6 text-primary-foreground shadow-lg sm:px-8 sm:py-8">
        <div className="dash-orb pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/15 blur-2xl" />
        <div
          className="dash-orb pointer-events-none absolute -bottom-20 left-10 size-48 rounded-full bg-emerald-400/25 blur-2xl"
          style={{ animationDelay: "1.4s" }}
        />
        <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium tracking-wide uppercase">
                <span className="dash-pulse size-1.5 rounded-full bg-emerald-300" />
                Usine · {data.roleLabel}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium">
                {data.hasEau ? <Droplets className="size-3.5" /> : null}
                {data.hasVin ? <Wine className="size-3.5" /> : null}
                {modules}
              </span>
            </div>
            <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight sm:text-3xl">
              <Factory className="size-7 shrink-0 opacity-90 sm:size-8" />
              {now ? greeting(now, data.userName) : props.greetingText}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-[15px]">
              {data.mission}
            </p>
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

      {steps.length > 0 ? (
        <section
          className="dash-fade-up space-y-3"
          style={{ animationDelay: "80ms" }}
        >
          <div className="flex items-center gap-2">
            <Factory className="size-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-semibold tracking-wide uppercase">
              Comment ça marche ici
            </h2>
          </div>
          <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
            {isMarketer
              ? "Parcours marketeur uniquement : float, ventes et clients. Pas de chambres, pas de guichet, pas de dépôt."
              : "Circuit usine — fournisseur, production, float, puis vente. Distinct de l’hôtel, de l’agence et de la boutique."}
          </p>
          <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {steps.map((step, i) => {
              const Icon = step.icon;
              return (
                <li
                  key={`${step.cardId}-${step.title}`}
                  className="usine-flow-step"
                  style={{ animationDelay: `${120 + i * 90}ms` }}
                >
                  <Link
                    href={step.href}
                    className="group flex h-full items-start gap-3 rounded-2xl border border-border/80 bg-gradient-to-br from-emerald-500/10 via-card to-sky-500/[0.06] p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-emerald-500/35 hover:shadow-md"
                  >
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-sm font-semibold text-emerald-700 transition group-hover:bg-emerald-600 group-hover:text-white dark:text-emerald-300">
                      {i + 1}
                    </span>
                    <div className="min-w-0 pt-0.5">
                      <p className="flex items-center gap-1.5 font-semibold text-foreground group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                        <Icon className="size-4 shrink-0 opacity-70" />
                        {step.title}
                        <ArrowRight className="size-3.5 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </p>
                      <p className="mt-1 text-sm leading-snug text-muted-foreground">
                        {step.explanation}
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}

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
                style={{ animationDelay: `${200 + i * 70}ms` }}
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
        <section
          className="dash-fade-up space-y-3"
          style={{ animationDelay: "360ms" }}
        >
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

      {sections.map((section, sIdx) => (
        <DashboardSection
          key={section.title}
          title={section.title}
          titleColor={section.titleColor}
          icon={section.icon}
          iconColor={section.iconColor}
          delay={420 + sIdx * 80}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {section.items.map((item, i) => (
              <DashboardMenuCard
                key={item.href + item.title}
                href={item.href}
                title={item.title}
                description={item.description}
                icon={item.icon}
                iconBg={item.iconBg}
                iconColor={item.iconColor}
                primary={item.primary}
                delay={i * 40}
              />
            ))}
          </div>
        </DashboardSection>
      ))}
    </div>
  );
}
