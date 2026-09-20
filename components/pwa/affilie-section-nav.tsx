"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function AffilieSectionNav({ base }: { base: string }) {
  const pathname = usePathname();
  const items = [
    { href: base, label: "Tableau de bord", exact: true },
    { href: `${base}/demande`, label: "Commander" },
    { href: `${base}/preferences`, label: "Préférences" },
  ] as const;

  return (
    <nav
      className="flex flex-wrap gap-1 rounded-xl bg-muted/50 p-1 ring-1 ring-border"
      aria-label="Portail affilié"
    >
      {items.map((item) => {
        const active = item.exact
          ? pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex h-9 flex-1 items-center justify-center rounded-lg px-3 text-sm font-medium transition sm:flex-none",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background hover:text-foreground",
            )}
            aria-current={active ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
