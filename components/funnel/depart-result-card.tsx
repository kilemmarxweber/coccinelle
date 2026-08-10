"use client";

import Link from "next/link";
import { ArrowRight, Plane, Bus, Ship } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  formatDateFr,
  formatMontantFc,
  MODE_TRANSPORT_LABELS,
} from "@/lib/reservation/labels";
import { cn } from "@/lib/utils";
import type { SearchDepartResult } from "@/lib/search-departs/types";

export type DepartResultCardProps = {
  depart: SearchDepartResult;
  onSelect?: (depart: SearchDepartResult) => void;
  /** Lien direct (PWA) — prioritaire sur `onSelect` si fourni. */
  href?: string;
  selected?: boolean;
  className?: string;
  ctaLabel?: string;
};

export function DepartResultCard({
  depart,
  onSelect,
  href,
  selected = false,
  className,
  ctaLabel = "Choisir",
}: DepartResultCardProps) {
  const ModeIcon =
    depart.modeTransport === "AVION"
      ? Plane
      : depart.modeTransport === "BATEAU"
        ? Ship
        : Bus;
  const placesLabel = depart.complet
    ? "Complet"
    : `${depart.placesRestantes} place${depart.placesRestantes !== 1 ? "s" : ""} restante${depart.placesRestantes !== 1 ? "s" : ""}`;
  const showCta = Boolean(href || onSelect);
  const linkHref = href && !depart.complet ? href : undefined;

  return (
    <Card
      className={cn(
        "overflow-hidden",
        selected && "border-primary ring-2 ring-primary/20",
        className,
      )}
      data-selected={selected || undefined}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5">
              <ModeIcon className="size-5 text-primary" aria-hidden />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base">
                {depart.villeDepart} → {depart.villeArrivee}
              </CardTitle>
              <CardDescription>
                {formatDateFr(depart.dateDepart)} · {depart.heureDepart}
              </CardDescription>
            </div>
          </div>
          <Badge variant={depart.complet ? "secondary" : "outline"}>
            {MODE_TRANSPORT_LABELS[depart.modeTransport]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 pt-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-muted-foreground">À partir de</span>
          <span className="text-lg font-semibold tabular-nums">
            {formatMontantFc(depart.prixBase)}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{placesLabel}</p>
        {depart.complet && (
          <Badge variant="secondary" className="w-fit">
            Complet
          </Badge>
        )}
      </CardContent>
      {showCta && (
        <CardFooter className="pt-0">
          <Button
            type="button"
            className="h-11 w-full"
            variant={selected ? "secondary" : "default"}
            disabled={depart.complet}
            render={linkHref ? <Link href={linkHref} /> : undefined}
            onClick={
              !linkHref && onSelect ? () => onSelect(depart) : undefined
            }
          >
            {selected ? "Sélectionné" : ctaLabel}
            {!selected && !depart.complet && (
              <ArrowRight data-icon="inline-end" aria-hidden />
            )}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
