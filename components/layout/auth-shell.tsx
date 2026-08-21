import type { ReactNode } from "react";
import Link from "next/link";
import { Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import { appName } from "@/lib/app-name";

type AuthMode = "sign-in" | "sign-up";

interface AuthShellProps {
  mode: AuthMode;
  children: ReactNode;
  className?: string;
}

const panelCopy: Record<
  AuthMode,
  {
    title: string;
    description: string;
    ctaLabel: string;
    ctaHref: string;
    quote: string;
  }
> = {
  "sign-in": {
    title: "Nouveau dans l'équipe ?",
    description:
      "Créez votre compte opérateur et gérez réservations, caisse et équipes depuis un seul espace.",
    ctaLabel: "Créer un compte",
    ctaHref: "/auth/sign-up",
    quote: "Voyager loin, c’est commencer ici.",
  },
  "sign-up": {
    title: "Déjà un compte ?",
    description:
      "Reconnectez-vous à la console pour reprendre la gestion de vos trajets et passagers.",
    ctaLabel: "Se connecter",
    ctaHref: "/auth/sign-in",
    quote: "Chaque trajet commence par une connexion.",
  },
};

/** Écran auth split : formulaire + panneau accent (même logique que HK+). */
export function AuthShell({ mode, children, className }: AuthShellProps) {
  const panel = panelCopy[mode];
  const badge = appName().toUpperCase();

  return (
    <div
      className={cn(
        "relative flex min-h-svh items-center justify-center overflow-x-hidden bg-background px-3 py-5 sm:px-6 sm:py-8",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--primary)_18%,transparent),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_color-mix(in_oklab,var(--primary)_8%,transparent),_transparent_40%)]"
      />

      <div className="relative z-10 w-full max-w-[26.5rem] overflow-hidden rounded-2xl border border-border shadow-2xl shadow-black/50 sm:max-w-xl md:max-w-[52rem] md:grid md:grid-cols-[1.1fr_0.9fr] md:rounded-[1.5rem]">
        <div className="bg-card px-5 py-5 sm:px-7 sm:py-6 lg:px-8 lg:py-7">
          {children}
        </div>

        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-blue-800 p-6 text-primary-foreground md:flex md:flex-col md:justify-between lg:p-7">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 size-64 rounded-full bg-blue-400/40"
          />

          <div className="relative space-y-4">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 w-8 rounded-full",
                    i === 0 ? "bg-white" : "bg-white/35",
                  )}
                />
              ))}
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide backdrop-blur-sm">
              <Plane className="size-3.5" aria-hidden />
              {badge}
            </div>

            <div className="space-y-2 pt-1">
              <h2 className="text-2xl font-bold tracking-tight text-balance lg:text-[1.65rem]">
                {panel.title}
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-white/90">
                {panel.description}
              </p>
            </div>

            <Link
              href={panel.ctaHref}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-white/80 bg-transparent px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {panel.ctaLabel}
            </Link>
          </div>

          <p className="relative mt-6 text-sm text-white/80 italic">
            “{panel.quote}”
          </p>
        </aside>
      </div>
    </div>
  );
}
