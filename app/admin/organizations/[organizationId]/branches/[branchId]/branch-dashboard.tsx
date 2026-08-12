"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  DashboardMenuCard,
  DashboardSection,
} from "@/components/ui/dashboard-menu-card";
import { menuSectionsForBranch } from "@/lib/branch/branch-menus";
import { branchTypeDetailLabel } from "@/lib/branch/hospitality";
import { APP_ROLE } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const WELCOME_MS = 30_000;

function roleLabel(role: string | null | undefined) {
  if (role === APP_ROLE.ADMIN) return "Administrateur";
  if (role === APP_ROLE.USER) return "Utilisateur";
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Visiteur";
}

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
};

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
}: BranchDashboardProps) {
  const { data: session } = authClient.useSession();
  const [showWelcome, setShowWelcome] = useState(true);

  const user = session?.user;
  const userName = user?.name?.trim() || user?.email || "Visiteur";
  const sections = menuSectionsForBranch(
    organizationId,
    branchId,
    branchType,
    { hasStays, hasRestaurant },
  );
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
    const t = setTimeout(() => setShowWelcome(false), WELCOME_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-500 ease-out",
          showWelcome
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
        aria-hidden={!showWelcome}
      >
        <div className="overflow-hidden">
          <section className="mb-8 overflow-hidden rounded-2xl bg-primary px-6 py-7 shadow-sm shadow-primary/20 sm:px-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold text-primary-foreground sm:text-3xl">
                  Bonjour, {userName}
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-primary-foreground/85 sm:text-base">
                  Bienvenue sur votre espace de gestion d&apos;activité.
                  Sélectionnez une option pour commencer.
                </p>
                <p className="mt-3 text-xs text-primary-foreground/70">
                  {typeDetail} · {branchName}
                </p>
              </div>
              <div className="shrink-0 self-start rounded-full bg-background/95 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm">
                Droit : {roleLabel(user?.role)}
              </div>
            </div>
          </section>
        </div>
      </div>

      {sections.map((section) => (
        <DashboardSection
          key={section.title}
          title={section.title}
          titleColor={section.titleColor}
          icon={section.icon}
          iconColor={section.iconColor}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {section.items.map((item) => (
              <DashboardMenuCard
                key={item.title}
                href={item.href}
                title={item.title}
                description={item.description}
                icon={item.icon}
                iconBg={item.iconBg}
                iconColor={item.iconColor}
                primary={item.primary}
              />
            ))}
          </div>
        </DashboardSection>
      ))}
    </main>
  );
}
