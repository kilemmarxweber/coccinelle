"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMontantFc } from "@/lib/reservation/labels";
import type { GuichetFormState } from "./use-guichet-form";

type Props = { form: GuichetFormState };

export function GuichetColisSection({ form }: Props) {
  const { colis, passagers, voyage } = form;
  const colisOnly = passagers.nombrePlaces === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Colis</CardTitle>
          {!colisOnly && (
            <Button
              type="button"
              variant={colis.include ? "default" : "outline"}
              size="sm"
              onClick={() => colis.setInclude((v) => !v)}
            >
              {colis.include ? "Inclus" : "Ajouter"}
            </Button>
          )}
        </div>
        {colis.show && (
          <CardDescription>
            {colisOnly
              ? "Réservation colis uniquement — type obligatoire."
              : "Optionnel en complément des billets."}
          </CardDescription>
        )}
      </CardHeader>
      {colis.show && (
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select
              className="h-11"
              value={colis.type}
              onChange={(e) => colis.setType(e.target.value as "ORDINAIRE" | "SPECIAL")}
            >
              <option value="ORDINAIRE">Ordinaire</option>
              <option value="SPECIAL">Spécial</option>
            </Select>
          </div>
          {colis.type === "ORDINAIRE" ? (
            <div className="space-y-1.5">
              <Label>Poids (kg)</Label>
              <Input
                type="number"
                min={0}
                className="h-11"
                value={colis.poids}
                onChange={(e) => colis.setPoids(e.target.value)}
              />
              {voyage.selectedTrajet && (
                <p className="text-xs text-muted-foreground">
                  {voyage.selectedTrajet.kilosGratuits} kg gratuits, puis{" "}
                  {formatMontantFc(voyage.selectedTrajet.prixParKilo)}/kg
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Montant fixe</Label>
              <Input
                type="number"
                min={0}
                className="h-11"
                value={colis.montant}
                onChange={(e) => colis.setMontant(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Commentaire</Label>
            <Textarea
              value={colis.commentaire}
              onChange={(e) => colis.setCommentaire(e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      )}
    </Card>
  );
}
