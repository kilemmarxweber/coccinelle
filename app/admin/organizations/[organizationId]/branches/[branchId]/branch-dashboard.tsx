"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  DashboardMenuCard,
  DashboardSection,
} from "@/components/ui/dashboard-menu-card";
import {
  filterMenuSectionsForOpsRole,
  menuSectionsForBranch,
} from "@/lib/branch/branch-menus";
import { branchTypeDetailLabel, isHospitality } from "@/lib/branch/hospitality";
import {
  DASH_CARD,
  opsRoleLabel,
  type OpsRole,
  isLegacyCaissierRole,
} from "@/lib/branch/ops-roles";
import { isPayrollManagerRole, isPayrollPointerRole } from "@/lib/payroll/constants";

export type BranchDashboardProps = {
  organizationId: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  branchType: string;
  hasStays: boolean;
  hasRestaurant: boolean;
  hasAvion: boolean;
  hasBus: boolean;
  hasBateau: boolean;
  hasPharmacie: boolean;
  hasShop: boolean;
  hasAlimentation: boolean;
  organizationName: string;
  opsRole: OpsRole;
  /** Cartes VIEW autorisées (DB) ; "ALL" = propriétaire. */
  allowedCardIds?: string[] | "ALL";
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

function missionForType(type: string, hasStays: boolean, hasRestaurant: boolean) {
  if (type === "BOUTIQUE") {
    return "Caisse, stock, catalogue et paie — le quotidien de la boutique, au même endroit.";
  }
  if (isHospitality(type)) {
    if (hasStays && hasRestaurant) {
      return "Séjours, restauration et caisse — l’hôtel en un coup d’œil.";
    }
    if (hasRestaurant) {
      return "Service, stock et encaissement — le restaurant en direct.";
    }
    return "Réception, chambres et caisse — l’hébergement au quotidien.";
  }
  return "Guichet, trajets, colis et caisse — l’agence prête à vendre.";
}

export function BranchDashboard({
  organizationId,
  branchId,
  branchName,
  branchType,
  hasStays,
  hasRestaurant,
  hasAvion,
  hasBus,
  hasBateau,
  hasPharmacie,
  hasShop,
  hasAlimentation,
  opsRole,
  allowedCardIds,
}: BranchDashboardProps) {
  const { data: session } = authClient.useSession();
  const [now, setNow] = useState(() => new Date());

  const user = session?.user;
  const userName = user?.name?.trim() || user?.email || "Visiteur";
  const rawSections = menuSectionsForBranch(
    organizationId,
    branchId,
    branchType,
    { hasStays, hasRestaurant },
  );
  const allowedSet =
    allowedCardIds === "ALL"
      ? ("ALL" as const)
      : allowedCardIds
        ? new Set(allowedCardIds)
        : null;
  const hospitalityFiltered = isHospitality(branchType)
    ? filterMenuSectionsForOpsRole(rawSections, opsRole, allowedSet)
    : rawSections;
  const sections =
    branchType === "BOUTIQUE"
      ? hospitalityFiltered
          .map((section) => ({
            ...section,
            items: section.items.filter((item) => {
              if (item.id === DASH_CARD.PAIE) return isPayrollManagerRole(opsRole);
              if (item.id === DASH_CARD.PAIE_PRESENCES) {
                return isPayrollPointerRole(opsRole);
              }
              return true;
            }),
          }))
          .filter((section) => section.items.length > 0)
      : hospitalityFiltered;
  const typeDetail = branchTypeDetailLabel({
    type: branchType,
    hasStays,
    hasRestaurant,
    hasAvion,
    hasBus,
    hasBateau,
    hasPharmacie,
    hasShop,
    hasAlimentation,
  });

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-3 py-5 sm:px-6 sm:py-6">
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
              Hub · {opsRoleLabel(opsRole)}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {greeting(now, userName)}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85 sm:text-[15px]">
              {missionForType(branchType, hasStays, hasRestaurant)}
            </p>
            {isLegacyCaissierRole(opsRole) ? (
              <p className="mt-3 max-w-xl text-xs text-amber-100/90">
                Profil caissier legacy : choisissez « Caissier séjours » ou
                « Caissier restauration » dans l’équipe.
              </p>
            ) : null}
          </div>
          <div className="flex flex-col items-start gap-1 text-sm text-white/80 lg:items-end">
            <p className="capitalize">{dateLabel(now)}</p>
            <p className="font-medium text-white">{branchName}</p>
            <p className="text-[11px] font-semibold tracking-wide text-white/70 uppercase">
              {typeDetail}
            </p>
          </div>
        </div>
      </section>

      {sections.map((section, sIdx) => (
        <DashboardSection
          key={section.title}
          title={section.title}
          titleColor={section.titleColor}
          icon={section.icon}
          iconColor={section.iconColor}
          delay={220 + sIdx * 90}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item, i) => (
              <DashboardMenuCard
                key={item.href}
                title={item.title}
                description={item.description}
                href={item.href}
                icon={item.icon}
                iconBg={item.iconBg}
                iconColor={item.iconColor}
                primary={item.primary}
                delay={280 + sIdx * 90 + i * 55}
              />
            ))}
          </div>
        </DashboardSection>
      ))}
    </div>
  );
}
