"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Plane, UserCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} - ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export type DashboardNavbarProps = {
  /** Titre principal (marque / org / branche). */
  title: string;
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
    <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
        <Link href={titleHref} className="flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:size-9">
            <Plane className="size-4" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-base font-bold tracking-tight text-primary sm:text-lg">
              {title}
            </span>
            {subtitle ? (
              <span className="hidden truncate text-[10px] tracking-wide text-muted-foreground uppercase sm:block">
                {subtitle}
              </span>
            ) : null}
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground tabular-nums md:block md:text-sm">
            {now ? formatDateTime(now) : "\u00A0"}
          </div>

          <ThemeToggle />

          {actions}

          <div className="flex max-w-[9rem] items-center gap-2 sm:max-w-none">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <UserCircle className="size-5" />
            </div>
            <span className="truncate text-sm font-medium text-foreground">
              {isPending ? "…" : userName}
            </span>
          </div>

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={signingOut}
            onClick={handleSignOut}
            className="gap-1.5"
          >
            <LogOut className="size-3.5" />
            <span>{signingOut ? "…" : "Déconnexion"}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
