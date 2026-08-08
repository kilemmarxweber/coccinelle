"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitBranch, LogOut, Plane, UserCircle } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import type { ReactNode } from "react";
import {
  branchDashboardPath,
  organizationBranchesPath,
} from "@/lib/branch/paths";
import { APP_ROLE } from "@/lib/permissions";
import { cn } from "@/lib/utils";

const WELCOME_MS = 30_000;

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} - ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function roleLabel(role: string | null | undefined) {
  if (role === APP_ROLE.ADMIN) return "Administrateur";
  if (role === APP_ROLE.USER) return "Utilisateur";
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : "Visiteur";
}

function branchTypeLabel(type: string) {
  if (type === "AGENCE") return "Agence";
  if (type === "HOTEL") return "Hôtel";
  if (type === "BOUTIQUE") return "Boutique";
  return type;
}

export type BranchDashboardProps = {
  organizationId: string;
  branchId: string;
  branchName: string;
  branchCode: string;
  branchType: string;
  organizationName: string;
  /** Menu rendu côté serveur (icônes Lucide non sérialisables). */
  children: ReactNode;
};

export function BranchDashboard({
  organizationId,
  branchId,
  branchName,
  branchCode,
  branchType,
  organizationName,
  children,
}: BranchDashboardProps) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();
  const [now, setNow] = useState<Date | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const user = session?.user;
  const userName = user?.name?.trim() || user?.email || "Visiteur";
  const hubHref = branchDashboardPath(organizationId, branchId);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setShowWelcome(false), WELCOME_MS);
    return () => clearTimeout(t);
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
    <div className="min-h-svh bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-backdrop-filter:bg-card/80">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6 lg:px-8">
          <Link href={hubHref} className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground sm:size-9">
              <Plane className="size-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-base font-bold tracking-tight text-primary sm:text-lg">
                {branchName}
              </span>
              <span className="hidden truncate text-[10px] tracking-wide text-muted-foreground uppercase sm:block">
                {organizationName} · {branchTypeLabel(branchType)} · {branchCode}
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="hidden rounded-full bg-muted px-3 py-1.5 text-xs text-muted-foreground tabular-nums md:block md:text-sm">
              {now ? formatDateTime(now) : "\u00A0"}
            </div>

            <ThemeToggle />

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden gap-1.5 sm:inline-flex"
              render={
                <Link href={organizationBranchesPath(organizationId)} />
              }
            >
              <GitBranch className="size-3.5" />
              Branches
            </Button>

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
            <section className="relative mb-8 overflow-hidden rounded-2xl bg-primary px-6 py-7 shadow-sm shadow-primary/20 sm:px-8">
              <div className="pr-16">
                <h2 className="text-2xl font-bold text-primary-foreground sm:text-3xl">
                  Bonjour, {userName} 👋
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-primary-foreground/85 sm:text-base">
                  Bienvenue sur votre espace de gestion d&apos;activité. Sélectionnez
                  une option pour commencer.
                </p>
                <p className="mt-3 text-xs text-primary-foreground/70">
                  {branchTypeLabel(branchType)} · {branchName}
                </p>
              </div>
              <div className="absolute top-5 right-5 rounded-full bg-background/95 px-3.5 py-1.5 text-xs font-semibold text-primary shadow-sm sm:top-6 sm:right-6">
                Droit : {roleLabel(user?.role)}
              </div>
            </section>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
