"use client";

import Link from "next/link";
import { Banknote, CalendarDays, Settings, UserRound } from "lucide-react";
import { boutiqueRoutes } from "@/lib/branch/paths";
import { cn } from "@/lib/utils";

type Props = {
  organizationId: string;
  branchId: string;
  active: "presences" | "mois" | "moi" | "parametres";
  showManage?: boolean;
  showPoint?: boolean;
};

export function PaieSectionNav({
  organizationId,
  branchId,
  active,
  showManage = false,
  showPoint = false,
}: Props) {
  const r = boutiqueRoutes;
  const items = [
    showPoint
      ? {
          id: "presences" as const,
          href: r.paiePresences(organizationId, branchId),
          label: "Présences",
          icon: CalendarDays,
        }
      : null,
    showManage
      ? {
          id: "mois" as const,
          href: r.paie(organizationId, branchId),
          label: "Paie du mois",
          icon: Banknote,
        }
      : null,
    {
      id: "moi" as const,
      href: r.paieMoi(organizationId, branchId),
      label: "Mes jours",
      icon: UserRound,
    },
    showManage
      ? {
          id: "parametres" as const,
          href: r.paieParametres(organizationId, branchId),
          label: "Paramètres",
          icon: Settings,
        }
      : null,
  ].filter(Boolean) as Array<{
    id: Props["active"];
    href: string;
    label: string;
    icon: typeof CalendarDays;
  }>;

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl bg-muted p-1"
      aria-label="Section paie"
    >
      {items.map((item) => {
        const on = active === item.id;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-1.5 rounded-lg px-3.5 text-sm font-medium transition",
              on
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/80 hover:text-foreground",
            )}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
