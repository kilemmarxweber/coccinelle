"use client";

import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  villeDepart?: string;
  villeArrivee?: string;
  placesRestantes?: number;
  complet?: boolean;
  express?: boolean;
  className?: string;
};

export function GuichetPlacesBandeau({
  villeDepart,
  villeArrivee,
  placesRestantes,
  complet,
  express,
  className,
}: Props) {
  const hasDepart = Boolean(villeDepart && villeArrivee);
  const placesLabel =
    placesRestantes === undefined
      ? null
      : complet || placesRestantes === 0
        ? "Complet — vente impossible"
        : `${placesRestantes} place${placesRestantes !== 1 ? "s" : ""} restante${placesRestantes !== 1 ? "s" : ""}`;

  return (
    <div
      className={cn(
        "sticky top-0 z-10 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-2.5 md:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {express ? <Badge>Vente express</Badge> : null}
          {hasDepart ? (
            <p className="truncate text-sm font-medium">
              {villeDepart} → {villeArrivee}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun départ sélectionné
            </p>
          )}
        </div>
        {placesLabel ? (
          <p
            className={cn(
              "flex items-center gap-1.5 text-sm font-medium",
              (complet || placesRestantes === 0) && "text-destructive",
            )}
          >
            {(complet || placesRestantes === 0) && (
              <AlertTriangle className="size-4" aria-hidden />
            )}
            {placesLabel}
          </p>
        ) : null}
      </div>
    </div>
  );
}
