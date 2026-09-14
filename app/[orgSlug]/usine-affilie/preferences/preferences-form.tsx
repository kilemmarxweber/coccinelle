"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  updateAffiliateNotifyPrefsAction,
  type FactoryNotifyPrefs,
} from "@/lib/factory/portal-actions";

export function AffiliePreferencesForm(props: {
  orgSlug: string;
  initial: FactoryNotifyPrefs | null;
}) {
  const [pending, start] = useTransition();
  const [eau, setEau] = useState(
    Boolean(props.initial?.families?.includes("EAU")),
  );
  const [vin, setVin] = useState(
    Boolean(props.initial?.families?.includes("VIN")),
  );
  const [waPromo, setWaPromo] = useState(Boolean(props.initial?.waPromo));
  const [waStock, setWaStock] = useState(Boolean(props.initial?.waStock));

  return (
    <form
      className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const families: ("EAU" | "VIN")[] = [];
        if (eau) families.push("EAU");
        if (vin) families.push("VIN");
        start(async () => {
          try {
            await updateAffiliateNotifyPrefsAction({
              orgSlug: props.orgSlug,
              prefs: { families, waPromo, waStock },
            });
            toast.success("Préférences enregistrées");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erreur");
          }
        });
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">Familles d’intérêt</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={eau}
            onChange={(e) => setEau(e.target.checked)}
          />
          Eau
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={vin}
            onChange={(e) => setVin(e.target.checked)}
          />
          Vins
        </label>
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold">WhatsApp</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={waPromo}
            onChange={(e) => setWaPromo(e.target.checked)}
          />
          Promotions
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={waStock}
            onChange={(e) => setWaStock(e.target.checked)}
          />
          Disponibilité stock
        </label>
        <p className="text-xs text-muted-foreground">
          Les crédits, paiements et validations de demande restent toujours
          notifiés si un téléphone est enregistré.
        </p>
      </fieldset>

      <Label className="sr-only">Enregistrer</Label>
      <Button type="submit" disabled={pending} className="h-11">
        Enregistrer
      </Button>
    </form>
  );
}
