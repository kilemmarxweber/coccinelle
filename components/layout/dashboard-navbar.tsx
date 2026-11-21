"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Plane } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} - ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export type DashboardNavbarProps = {
  /** Titre principal (marque / org / branche). Vide = icône seule. */
  title?: string;
  /** Sous-titre optionnel (slug, type…). */
  subtitle?: string;
  /** Lien du logo + titre. */
  titleHref: string;
  /** Actions supplémentaires à gauche du profil (ex. Branches). */
  actions?: ReactNode;
};

/** Navbar sticky — même look que le dashboard branche. */
export function DashboardNavbar({
  title,
  subtitle,
  titleHref,
  actions,
}: DashboardNavbarProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [now, setNow] = useState<Date | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const user = session?.user;
  const userName = user?.name?.trim() || user?.email || "Visiteur";
  const hasTitle = Boolean(title?.trim());
  const hasSubtitle = Boolean(subtitle?.trim());

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/auth/sign-in");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href={titleHref}
          className="flex min-w-0 items-center gap-2.5"
          aria-label="Accueil"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar text-white">
            <Plane className="size-4" aria-hidden />
          </span>
          {hasTitle || hasSubtitle ? (
            <span className="min-w-0">
              {hasTitle ? (
                <span className="block truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
                  {title}
                </span>
              ) : null}
              {hasSubtitle ? (
                <span className="hidden truncate text-[11px] text-muted-foreground sm:block">
                  {subtitle}
                </span>
              ) : null}
            </span>
          ) : null}
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden text-xs text-muted-foreground tabular-nums md:block">
            {now ? formatDateTime(now) : "\u00A0"}
          </div>

          <ThemeToggle />

          {actions}

          <div className="flex max-w-[9rem] items-center gap-2 sm:max-w-none">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {isPending ? "…" : initials(userName)}
            </div>
            <span className="truncate text-[13px] font-semibold text-foreground">
              {isPending ? "…" : userName}
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={signingOut}
            onClick={handleSignOut}
            className="gap-1.5 text-muted-foreground"
          >
            <LogOut className="size-3.5" />
            <span>{signingOut ? "…" : "Déconnexion"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
