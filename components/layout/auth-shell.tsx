import type { ReactNode } from "react";
import Link from "next/link";
import { Plane } from "lucide-react";
import { cn } from "@/lib/utils";

type AuthMode = "sign-in" | "sign-up";

interface AuthShellProps {
  mode: AuthMode;
  children: ReactNode;
  className?: string;
}

const panelCopy: Record<
  AuthMode,
  {
    badge: string;
    title: string;
    description: string;
    ctaLabel: string;
    ctaHref: string;
    quote: string;
  }
> = {
  "sign-in": {
    badge: "COCCINELLE V.0.1",
    title: "Nouveau dans l'équipe ?",
    description:
      "Créez votre compte opérateur et gérez vos commandes, réservations et colis en quelques minutes.",
    ctaLabel: "Créer un compte",
    ctaHref: "/auth/sign-up",
    quote: "Voyager loin, c’est commencer ici.",
  },
  "sign-up": {
    badge: "COCCINELLE V 0.1",
    title: "Déjà un compte ?",
    description:
      "Reconnectez-vous à la console pour reprendre la gestion de vos trajets et passagers.",
    ctaLabel: "Se connecter",
    ctaHref: "/auth/sign-in",
    quote: "Chaque trajet commence par une connexion.",
  },
};

/** Écran auth split : formulaire sombre + panneau accent bleu. */
export function AuthShell({ mode, children, className }: AuthShellProps) {
  const panel = panelCopy[mode];

  return (
    <div
      className={cn(
        "relative flex min-h-svh items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_color-mix(in_oklab,var(--primary)_18%,transparent),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_color-mix(in_oklab,var(--primary)_8%,transparent),_transparent_40%)]"
      />

      <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-[1.75rem] border border-border shadow-2xl shadow-black/50 md:grid md:grid-cols-[1.15fr_0.85fr]">
        <div className="bg-card px-6 py-8 sm:px-10 sm:py-10 lg:px-12">{children}</div>

        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-primary via-primary to-blue-800 p-8 text-primary-foreground md:flex md:flex-col md:justify-between lg:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 -right-10 size-56 rounded-full bg-white/10"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 size-64 rounded-full bg-blue-400/40"
          />

          <div className="relative space-y-6">
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
              {panel.badge}
            </div>

            <div className="space-y-3 pt-4">
              <h2 className="text-3xl font-bold tracking-tight text-balance lg:text-4xl">
                {panel.title}
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-white/90 lg:text-base">
                {panel.description}
              </p>
            </div>

            <Link
              href={panel.ctaHref}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/80 bg-transparent px-5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              {panel.ctaLabel}
            </Link>
          </div>

          <p className="relative mt-10 text-sm text-white/80 italic">
            “{panel.quote}”
          </p>
        </aside>
      </div>
    </div>
  );
}
