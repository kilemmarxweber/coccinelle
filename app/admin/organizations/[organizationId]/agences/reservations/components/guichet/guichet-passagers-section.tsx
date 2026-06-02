"use client";

import * as React from "react";
import { Baby, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  CATEGORIE_PASSAGER_LABELS,
  formatMontantFc,
} from "@/lib/reservation/labels";
import { prixPassager } from "@/lib/reservation/pricing";
import type { GuichetFormState } from "./use-guichet-form";
import type { PassagerForm } from "./types";

type Props = { form: GuichetFormState };

export function GuichetPassagersSection({ form }: Props) {
  const { passagers, voyage } = form;
  const { nombrePlaces, setNombrePlaces, list, update } = passagers;

  if (nombrePlaces === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <PlacesHeader nombrePlaces={nombrePlaces} setNombrePlaces={setNombrePlaces} />
          <CardDescription>
            Les bébés n’occupent pas de place. Mettez 0 place pour une réservation colis seule.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <PlacesHeader nombrePlaces={nombrePlaces} setNombrePlaces={setNombrePlaces} />
        <CardDescription>
          Les bébés n’occupent pas de place. Mettez 0 place pour une réservation colis seule.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {list.map((p, index) => (
          <PassagerCard
            key={index}
            index={index}
            passager={p}
            tarifs={voyage.tarifs}
            onUpdate={(patch) => update(index, patch)}
          />
        ))}
      </CardContent>
    </Card>
  );
}

function PlacesHeader({
  nombrePlaces,
  setNombrePlaces,
}: {
  nombrePlaces: number;
  setNombrePlaces: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <CardTitle className="text-base">Passagers</CardTitle>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9"
          disabled={nombrePlaces <= 0}
          onClick={() => setNombrePlaces((n) => Math.max(0, n - 1))}
        >
          <Minus className="size-4" />
        </Button>
        <span className="min-w-[2ch] text-center font-semibold tabular-nums">
          {nombrePlaces}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-9"
          disabled={nombrePlaces >= 20}
          onClick={() => setNombrePlaces((n) => Math.min(20, n + 1))}
        >
          <Plus className="size-4" />
        </Button>
        <span className="text-sm text-muted-foreground">places</span>
      </div>
    </div>
  );
}

function PassagerCard({
  index,
  passager,
  tarifs,
  onUpdate,
}: {
  index: number;
  passager: PassagerForm;
  tarifs: GuichetFormState["voyage"]["tarifs"];
  onUpdate: (patch: Partial<PassagerForm>) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Passager {index + 1}
          {index === 0 && (
            <Badge variant="secondary" className="ml-2 text-xs">
              Client
            </Badge>
          )}
        </span>
        {passager.categorie === "BEBE" && (
          <Baby className="size-4 text-muted-foreground" />
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nom">
          <Input className="h-11" value={passager.nom} onChange={(e) => onUpdate({ nom: e.target.value })} />
        </Field>
        <Field label="Prénom">
          <Input className="h-11" value={passager.prenom} onChange={(e) => onUpdate({ prenom: e.target.value })} />
        </Field>
        <Field label="Catégorie">
          <Select
            className="h-11"
            value={passager.categorie}
            onChange={(e) => onUpdate({ categorie: e.target.value as PassagerForm["categorie"] })}
          >
            {(["ADULTE", "ENFANT", "BEBE"] as const).map((c) => (
              <option key={c} value={c}>
                {CATEGORIE_PASSAGER_LABELS[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sexe">
          <Select
            className="h-11"
            value={passager.sexe}
            onChange={(e) => onUpdate({ sexe: e.target.value as "M" | "F" })}
          >
            <option value="M">Homme</option>
            <option value="F">Femme</option>
          </Select>
        </Field>
        <Field label="Date de naissance" className="sm:col-span-2">
          <Input
            type="date"
            className="h-11"
            value={passager.dateNaissance}
            onChange={(e) => onUpdate({ dateNaissance: e.target.value })}
          />
        </Field>
      </div>
      {tarifs && (
        <p className="text-sm text-muted-foreground">
          Tarif : {formatMontantFc(prixPassager(tarifs, passager.categorie))}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
