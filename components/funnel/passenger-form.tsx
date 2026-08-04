"use client";

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CATEGORIE_PASSAGER_LABELS } from "@/lib/reservation/labels";
import { cn } from "@/lib/utils";

export type PassengerFormValues = {
  prenom: string;
  nom: string;
  sexe: "M" | "F";
  categorie: "ADULTE" | "ENFANT" | "BEBE";
  telephone?: string;
};

export type PassengerFormProps = {
  values: PassengerFormValues;
  onChange: (next: PassengerFormValues) => void;
  className?: string;
  idPrefix?: string;
  legend?: string;
  description?: string;
};

export function PassengerForm({
  values,
  onChange,
  className,
  idPrefix = "passenger",
  legend = "Passager",
  description = "Informations de base pour le billet.",
}: PassengerFormProps) {
  function patch(partial: Partial<PassengerFormValues>) {
    onChange({ ...values, ...partial });
  }

  return (
    <FieldSet className={cn(className)}>
      {legend ? <FieldLegend>{legend}</FieldLegend> : null}
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-prenom`}>Prénom</FieldLabel>
          <Input
            id={`${idPrefix}-prenom`}
            className="h-11"
            value={values.prenom}
            onChange={(e) => patch({ prenom: e.target.value })}
            autoComplete="given-name"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-nom`}>Nom</FieldLabel>
          <Input
            id={`${idPrefix}-nom`}
            className="h-11"
            value={values.nom}
            onChange={(e) => patch({ nom: e.target.value })}
            autoComplete="family-name"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-sexe`}>Sexe</FieldLabel>
          <Select
            id={`${idPrefix}-sexe`}
            className="h-11"
            value={values.sexe}
            onChange={(e) =>
              patch({ sexe: e.target.value as PassengerFormValues["sexe"] })
            }
          >
            <option value="M">Masculin</option>
            <option value="F">Féminin</option>
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-categorie`}>Catégorie</FieldLabel>
          <Select
            id={`${idPrefix}-categorie`}
            className="h-11"
            value={values.categorie}
            onChange={(e) =>
              patch({
                categorie: e.target.value as PassengerFormValues["categorie"],
              })
            }
          >
            {(
              Object.keys(CATEGORIE_PASSAGER_LABELS) as Array<
                PassengerFormValues["categorie"]
              >
            ).map((key) => (
              <option key={key} value={key}>
                {CATEGORIE_PASSAGER_LABELS[key]}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-telephone`}>Téléphone</FieldLabel>
          <Input
            id={`${idPrefix}-telephone`}
            type="tel"
            className="h-11"
            value={values.telephone ?? ""}
            onChange={(e) => patch({ telephone: e.target.value })}
            autoComplete="tel"
            placeholder="Optionnel"
          />
          <FieldDescription>Utile pour le contact embarquement.</FieldDescription>
        </Field>
      </FieldGroup>
    </FieldSet>
  );
}
