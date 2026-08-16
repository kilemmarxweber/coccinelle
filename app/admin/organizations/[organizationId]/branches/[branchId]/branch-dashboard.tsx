"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import {
  DashboardMenuCard,
  DashboardSection,
} from "@/components/ui/dashboard-menu-card";
import {
  filterMenuSectionsByVisibleCardIds,
  menuSectionsForBranch,
} from "@/lib/branch/branch-menus";
import { branchTypeDetailLabel } from "@/lib/branch/hospitality";
import { opsRoleLabel, type OpsRole } from "@/lib/branch/ops-roles";
import { cn } from "@/lib/utils";

const WELCOME_MS = 30_000;

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
  /** Cartes hub autorisées (catalogue FR · Voir) — plain IDs only. */
  visibleCardIds: string[];
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
  opsRole,
  visibleCardIds,
}: BranchDashboardProps) {
  const { data: session } = authClient.useSession();
  const [showWelcome, setShowWelcome] = useState(true);

  const user = session?.user;
  const userName = user?.name?.trim() || user?.email || "Visiteur";
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

  const menuSections = filterMenuSectionsByVisibleCardIds(
    menuSectionsForBranch(organizationId, branchId, branchType, {
      hasStays,
      hasRestaurant,
    }),
    visibleCardIds,
  );

  useEffect(() => {
    const t = setTimeout(() => setShowWelcome(false), WELCOME_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div
        className={cn(
          "overflow-hidden transition-all duration-500",
          showWelcome ? "max-h-40 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <div className="rounded-2xl border border-border bg-card/60 px-4 py-3">
          <p className="text-sm font-medium">
            Bonjour {userName}{" "}
            <span className="text-muted-foreground">
              · {opsRoleLabel(opsRole)}
            </span>
          </p>
          <p className="text-xs text-muted-foreground">
            {branchName} · {typeDetail}
          </p>
        </div>
      </div>

      {menuSections.map((section) => (
        <DashboardSection
          key={section.title}
          title={section.title}
          titleColor={section.titleColor}
          icon={section.icon}
          iconColor={section.iconColor}
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => (
              <DashboardMenuCard
                key={item.href}
                title={item.title}
                description={item.description}
                href={item.href}
                icon={item.icon}
                iconBg={item.iconBg}
                iconColor={item.iconColor}
                primary={item.primary}
              />
            ))}
          </div>
        </DashboardSection>
      ))}
    </div>
  );
}
