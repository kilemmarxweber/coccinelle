"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateFr, formatMontantFc } from "@/lib/reservation/labels";
import { GuichetPaiementSelect } from "./guichet-paiement-select";
import type { GuichetFormState } from "./use-guichet-form";

type Props = { form: GuichetFormState };

export function GuichetRecap({ form }: Props) {
  const { voyage, passagers, pricing, paiement, submitting } = form;
  const { selectedTrajet, selectedDepart } = voyage;

  return (
    <aside className="space-y-4 md:sticky md:top-20 md:self-start">
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Récapitulatif</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {selectedTrajet && selectedDepart ? (
            <>
              <p className="font-medium">
                {selectedTrajet.villeDepart} → {selectedTrajet.villeArrivee}
              </p>
              <p className="text-muted-foreground">
                {formatDateFr(selectedDepart.dateDepart)} · {selectedDepart.heureDepart}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Sélectionnez trajet et départ</p>
          )}
          <Separator />
          {pricing ? (
            <>
              <Row
                label={`Billets (${passagers.nombrePlaces} place${passagers.nombrePlaces !== 1 ? "s" : ""})`}
                value={formatMontantFc(pricing.totalPassagers)}
              />
              {pricing.totalColis > 0 && (
                <Row label="Colis" value={formatMontantFc(pricing.totalColis)} />
              )}
              <Row
                label="Total"
                value={formatMontantFc(pricing.total)}
                className="pt-1 text-base font-semibold"
              />
            </>
          ) : (
            <p className="text-muted-foreground">—</p>
          )}
          <Separator />
          <GuichetPaiementSelect
            variant="desktop"
            value={paiement.mode}
            onChange={paiement.setMode}
          />
          <p className="text-xs text-muted-foreground">
            Politique de report : modifiable après création. Espèces → paiement marqué payé.
          </p>
          <Button
            type="submit"
            className="h-11 w-full touch-manipulation"
            disabled={submitting || !pricing}
          >
            {submitting ? "Création…" : "Confirmer la réservation"}
          </Button>
        </CardContent>
      </Card>
    </aside>
  );
}

function Row({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-between ${className ?? ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
