import type { ReactNode } from "react";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  /** Titre affiché sous le logo */
  headline: string;
  /** Description courte optionnelle */
  description?: string;
  /** Carte avec le formulaire */
  children: ReactNode;
  className?: string;
}

/** Présentation type « écran plein phone » avec dégradé discret et largeur contenue sur tablette. */
export function AuthShell({ headline, description, children, className }: AuthShellProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-svh flex-col bg-gradient-to-b from-primary/12 via-background to-background pb-12",
        className
      )}
    >
      <div
        style={{
          paddingTop: "max(1.25rem, env(safe-area-inset-top))",
          paddingLeft: "max(1rem, env(safe-area-inset-left))",
          paddingRight: "max(1rem, env(safe-area-inset-right))",
          paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))",
        }}
      >
        <div className="mx-auto flex max-w-[440px] flex-col md:mx-auto md:max-w-[480px]">
          <header className="mb-10 flex flex-col items-center gap-3 text-center">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-2xl border border-primary/25 bg-card/80 px-4 py-3 shadow-sm backdrop-blur-sm"
            >
              <span className="rounded-xl bg-primary p-2.5 text-primary-foreground">
                <BookOpen className="size-6" aria-hidden />
              </span>
              <div className="text-left">
                <p className="text-sm font-semibold leading-none">Coccinelle</p>
                <p className="mt-1 text-xs text-muted-foreground">Organisation</p>
              </div>
            </Link>
            <div>
              <h1 className="text-balance text-2xl font-semibold tracking-tight">{headline}</h1>
              {description && (
                <p className="mt-2 text-pretty text-sm text-muted-foreground">{description}</p>
              )}
            </div>
          </header>

          <div className="rounded-[1.35rem] border bg-card shadow-sm md:rounded-3xl md:shadow-md">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
