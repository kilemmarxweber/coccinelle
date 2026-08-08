import type { ReactNode } from "react";

/**
 * Espace Public (client) — route group `(public)`.
 * Pas de AdminShell ; pas d’auth staff obligatoire.
 * Les URLs restent `/` et `/{orgSlug}/…` (le groupe n’apparaît pas dans le path).
 */
export default function PublicSpaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="min-h-svh bg-background text-foreground">{children}</div>
  );
}
