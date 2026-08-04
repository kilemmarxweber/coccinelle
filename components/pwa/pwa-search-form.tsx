"use client";

import * as React from "react";
import {
  SearchBar,
  type SearchBarValues,
} from "@/components/funnel";
import { todayIsoLocal } from "@/lib/search-departs/day-bounds";

function nextWeekdayIso(targetDay: number): string {
  const date = new Date();
  const diff = (targetDay - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  return todayIsoLocal(date);
}

export type PwaSearchFormProps = {
  orgSlug: string;
  initial?: Partial<SearchBarValues>;
  idPrefix?: string;
};

export function PwaSearchForm({
  orgSlug,
  initial,
  idPrefix = "pwa-search",
}: PwaSearchFormProps) {
  const [pending, setPending] = React.useState(false);
  const [values, setValues] = React.useState<SearchBarValues>({
    villeDepart: initial?.villeDepart ?? "Kinshasa",
    villeArrivee: initial?.villeArrivee ?? "Lubumbashi",
    date: initial?.date ?? nextWeekdayIso(3),
    modeTransport: initial?.modeTransport ?? "",
  });

  function handleSubmit(next: SearchBarValues) {
    setPending(true);
    const params = new URLSearchParams({
      from: next.villeDepart.trim(),
      to: next.villeArrivee.trim(),
      date: next.date,
    });
    if (next.modeTransport) {
      params.set("mode", next.modeTransport);
    }
    // Navigation pleine page : fiable sur `/[orgSlug]/recherche` (soft nav parfois bloquée).
    window.location.assign(`/${orgSlug}/recherche?${params.toString()}`);
  }

  return (
    <SearchBar
      values={values}
      onChange={setValues}
      onSubmit={handleSubmit}
      pending={pending}
      idPrefix={idPrefix}
    />
  );
}
