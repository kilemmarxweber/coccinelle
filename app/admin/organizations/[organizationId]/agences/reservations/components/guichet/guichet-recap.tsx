"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatDateFr, formatMontantFc } from "@/lib/reservation/labels";
import { GuichetPaiementSelect } from "./guichet-paiement-select";
import type { GuichetFormState } from "./use-guichet-form";

type Props = { form: GuichetFormState };

export function GuichetRecap({ form }: Props) {
  const {
    voyage,
    passagers,
    pricing,
    paiement,
    submitting,
    step,
    setStep,
    handleSubmit,
  } = form;
  const depart = voyage.selectedDepart;

  return (
    <aside className="flex flex-col gap-4 md:sticky md:top-20 md:self-start">
      <Card className="border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Récapitulatif</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          {depart ? (
            <>
              <p className="font-medium">
                {depart.villeDepart} → {depart.villeArrivee}
              </p>
              <p className="text-muted-foreground">
                {formatDateFr(depart.dateDepart)} · {depart.heureDepart}
              </p>
              <p className="text-muted-foreground">
                {depart.complet
                  ? "Complet"
                  : `${depart.placesRestantes} place${depart.placesRestantes !== 1 ? "s" : ""} restante${depart.placesRestantes !== 1 ? "s" : ""}`}
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">Sélectionnez un départ</p>
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
          {step === "paiement" ? (
            <GuichetPaiementSelect
              variant="desktop"
              value={paiement.mode}
              onChange={paiement.setMode}
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Paiement à l’étape finale · espèces → payé au guichet.
            </p>
          )}
          {step === "paiement" ? (
            <Button
              type="button"
              className="h-11 w-full touch-manipulation"
              disabled={submitting || !pricing || Boolean(depart?.complet)}
              onClick={() => handleSubmit()}
            >
              {submitting ? "Création…" : "Confirmer la réservation"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              className="h-11 w-full"
              disabled={!depart}
              onClick={() => {
                if (!depart) return;
                if (step === "recherche") setStep("client");
              }}
            >
              {depart ? "Départ sélectionné" : "Choisir un départ"}
            </Button>
          )}
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
