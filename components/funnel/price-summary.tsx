"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatMontantFc } from "@/lib/reservation/labels";
import {
  computeReservationPricing,
  type ColisPricingInput,
  type TrajetTarifs,
} from "@/lib/reservation/pricing";
import { cn } from "@/lib/utils";

export type PriceSummaryProps = {
  tarifs: TrajetTarifs;
  /** Nombre d'adultes (mock / démo locale OK). */
  adultCount: number;
  onAdultCountChange?: (count: number) => void;
  enfantCount?: number;
  bebeCount?: number;
  colis?: ColisPricingInput;
  className?: string;
  title?: string;
  description?: string;
  minAdults?: number;
  maxAdults?: number;
};

export function PriceSummary({
  tarifs,
  adultCount,
  onAdultCountChange,
  enfantCount = 0,
  bebeCount = 0,
  colis,
  className,
  title = "Récapitulatif",
  description,
  minAdults = 1,
  maxAdults = 9,
}: PriceSummaryProps) {
  const passagers = [
    ...Array.from({ length: Math.max(0, adultCount) }, () => ({
      categorie: "ADULTE" as const,
    })),
    ...Array.from({ length: Math.max(0, enfantCount) }, () => ({
      categorie: "ENFANT" as const,
    })),
    ...Array.from({ length: Math.max(0, bebeCount) }, () => ({
      categorie: "BEBE" as const,
    })),
  ];

  const pricing = computeReservationPricing(tarifs, passagers, colis);
  const billetsCount = adultCount + enfantCount + bebeCount;

  function setAdults(next: number) {
    const clamped = Math.min(maxAdults, Math.max(minAdults, next));
    onAdultCountChange?.(clamped);
  }

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {onAdultCountChange ? (
          <div className="flex items-center justify-between gap-3">
            <span id="price-summary-adults-label">Adultes</span>
            <div
              className="flex items-center gap-2"
              role="group"
              aria-labelledby="price-summary-adults-label"
            >
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Retirer un adulte"
                disabled={adultCount <= minAdults}
                onClick={() => setAdults(adultCount - 1)}
              >
                <Minus />
              </Button>
              <span
                className="min-w-8 text-center font-medium tabular-nums"
                aria-live="polite"
              >
                {adultCount}
              </span>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                aria-label="Ajouter un adulte"
                disabled={adultCount >= maxAdults}
                onClick={() => setAdults(adultCount + 1)}
              >
                <Plus />
              </Button>
            </div>
          </div>
        ) : null}

        <Separator />

        <div className="flex justify-between gap-2">
          <span>
            Billets
            {billetsCount > 0
              ? ` (${billetsCount} place${billetsCount !== 1 ? "s" : ""})`
              : ""}
          </span>
          <span className="tabular-nums">
            {formatMontantFc(pricing.totalPassagers)}
          </span>
        </div>

        {(colis?.type || pricing.totalColis > 0) && (
          <div className="flex justify-between gap-2">
            <span>Colis</span>
            <span className="tabular-nums">
              {formatMontantFc(pricing.totalColis)}
            </span>
          </div>
        )}

        <Separator />

        <div className="flex justify-between gap-2 pt-1 text-base font-semibold">
          <span>Total</span>
          <span
            className="tabular-nums"
            aria-live="polite"
            data-testid="price-summary-total"
          >
            {formatMontantFc(pricing.total)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
