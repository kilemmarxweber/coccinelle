"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  STATUT_PAIEMENT_LABELS,
  STATUT_RESERVATION_LABELS,
  SOURCE_RESERVATION_LABELS,
} from "@/lib/reservation/labels";

export function StatutReservationBadge({
  statut,
  className,
}: {
  statut: string;
  className?: string;
}) {
  const variant =
    statut === "CONFIRME"
      ? "default"
      : statut === "EMBARQUE"
        ? "secondary"
        : statut === "ANNULE" || statut === "RATE"
          ? "destructive"
          : "outline";

  return (
    <Badge variant={variant} className={cn("text-xs", className)}>
      {STATUT_RESERVATION_LABELS[statut] ?? statut}
    </Badge>
  );
}

export function StatutPaiementBadge({
  statut,
  className,
}: {
  statut: string;
  className?: string;
}) {
  const variant =
    statut === "PAYE"
      ? "secondary"
      : statut === "ECHOUE"
        ? "destructive"
        : "outline";

  return (
    <Badge
      variant={variant}
      className={cn(
        "text-xs",
        statut === "PAYE" && "bg-success/15 text-success-foreground border-success/30",
        className,
      )}
    >
      {STATUT_PAIEMENT_LABELS[statut] ?? statut}
    </Badge>
  );
}

export function SourceReservationBadge({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("text-xs", className)}>
      {SOURCE_RESERVATION_LABELS[source] ?? source}
    </Badge>
  );
}
