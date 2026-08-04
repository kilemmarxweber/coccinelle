"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type SearchBarValues = {
  villeDepart: string;
  villeArrivee: string;
  date: string;
  modeTransport: "" | "BUS" | "AVION";
};

export type SearchBarProps = {
  values: SearchBarValues;
  onChange: (next: SearchBarValues) => void;
  onSubmit: (values: SearchBarValues) => void | Promise<void>;
  pending?: boolean;
  className?: string;
  idPrefix?: string;
};

export function SearchBar({
  values,
  onChange,
  onSubmit,
  pending = false,
  className,
  idPrefix = "funnel-search",
}: SearchBarProps) {
  function patch(partial: Partial<SearchBarValues>) {
    onChange({ ...values, ...partial });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit(values);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("rounded-xl border bg-card p-4 shadow-xs", className)}
      aria-label="Recherche de départs"
    >
      <FieldGroup className="gap-3 md:grid md:grid-cols-2 lg:grid-cols-5 lg:items-end lg:gap-3">
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-depart`}>Départ</FieldLabel>
          <Input
            id={`${idPrefix}-depart`}
            className="h-11"
            value={values.villeDepart}
            onChange={(e) => patch({ villeDepart: e.target.value })}
            placeholder="Ville de départ"
            autoComplete="off"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-arrivee`}>Arrivée</FieldLabel>
          <Input
            id={`${idPrefix}-arrivee`}
            className="h-11"
            value={values.villeArrivee}
            onChange={(e) => patch({ villeArrivee: e.target.value })}
            placeholder="Ville d'arrivée"
            autoComplete="off"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-date`}>Date</FieldLabel>
          <Input
            id={`${idPrefix}-date`}
            type="date"
            className="h-11"
            value={values.date}
            onChange={(e) => patch({ date: e.target.value })}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${idPrefix}-mode`}>Mode</FieldLabel>
          <Select
            id={`${idPrefix}-mode`}
            className="h-11"
            value={values.modeTransport}
            onChange={(e) =>
              patch({
                modeTransport: e.target.value as SearchBarValues["modeTransport"],
              })
            }
          >
            <option value="">Tous</option>
            <option value="BUS">Bus</option>
            <option value="AVION">Avion</option>
          </Select>
        </Field>
        <div className="md:col-span-2 lg:col-span-1">
          <Button
            type="submit"
            className="h-11 w-full"
            disabled={pending}
            aria-busy={pending}
          >
            {pending ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <Search data-icon="inline-start" aria-hidden />
            )}
            {pending ? "Recherche…" : "Rechercher"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
