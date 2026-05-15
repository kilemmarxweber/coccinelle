"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Shield, Users, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrgNavLink {
  href: string;
  /** Libellé complet (tablette / bureau) */
  label: string;
  /** Libellé court pour téléphone */
  shortLabel: string;
  icon: LucideIcon;
  isActive: (pathname: string) => boolean;
}

function buildLinks(organizationId: string): OrgNavLink[] {
  const base = `/admin/organizations/${organizationId}`;
  return [
    {
      href: base,
      label: "Accueil",
      shortLabel: "Accueil",
      icon: Home,
      isActive: (p) => p === base || p === `${base}/`,
    },
    {
      href: `${base}/members`,
      label: "Membres",
      shortLabel: "Membres",
      icon: Users,
      isActive: (p) => p.startsWith(`${base}/members`),
    },
    {
      href: `${base}/roles`,
      label: "Rôles & permissions",
      shortLabel: "Rôles",
      icon: Shield,
      isActive: (p) => p.startsWith(`${base}/roles`),
    },
  ];
}

export function OrganizationContextNav({ organizationId }: { organizationId: string }) {
  const pathname = usePathname();
  const links = buildLinks(organizationId);

  return (
    <div className="border-b border-border bg-muted/30">
      <nav
        className="mx-auto flex max-w-4xl gap-1 px-[max(0.5rem,env(safe-area-inset-left))] pr-[max(0.5rem,env(safe-area-inset-right))] sm:gap-1.5 sm:overflow-x-auto sm:px-4 md:px-6"
        aria-label="Navigation organisation"
      >
        {links.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex min-h-13 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-xs font-medium transition-colors sm:min-h-0 sm:flex-initial sm:flex-row sm:gap-2 sm:px-3 sm:py-2.5 sm:text-sm",
                "touch-manipulation active:bg-muted/80",
                active
                  ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              <Icon className="size-5 shrink-0 sm:size-4" aria-hidden />
              <span className="max-w-full text-center leading-tight sm:whitespace-nowrap">
                <span className="sm:hidden">{item.shortLabel}</span>
                <span className="hidden sm:inline">{item.label}</span>
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
