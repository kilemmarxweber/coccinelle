"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatDateFr, formatMontantFc } from "@/lib/reservation/labels";
import type { GuichetFormState } from "./use-guichet-form";

type Props = { form: GuichetFormState };

export function GuichetTrajetSection({ form }: Props) {
  const { voyage, trajets } = form;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Trajet et départ</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Trajet</Label>
          <Select
            value={voyage.trajetId}
            onChange={(e) => voyage.setTrajetId(e.target.value)}
            className="h-11"
          >
            <option value="">Choisir un trajet</option>
            {trajets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.villeDepart} → {t.villeArrivee} ({formatMontantFc(t.prixBase)})
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Départ</Label>
          <Select
            value={voyage.departId}
            onChange={(e) => voyage.setDepartId(e.target.value)}
            className="h-11"
            disabled={!voyage.trajetId}
          >
            <option value="">Choisir une date</option>
            {voyage.departs.map((d) => (
              <option key={d.id} value={d.id}>
                {formatDateFr(d.dateDepart)} · {d.heureDepart} ({d.statut})
              </option>
            ))}
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
