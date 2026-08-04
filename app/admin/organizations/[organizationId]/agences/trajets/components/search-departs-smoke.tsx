"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListGroup, ListItem } from "@/components/ui/list-item";
import { Select } from "@/components/ui/select";
import {
  formatDateFr,
  formatMontantFc,
  MODE_TRANSPORT_LABELS,
} from "@/lib/reservation/labels";
import { searchDepartsAction } from "@/lib/search-departs/actions";
import type { SearchDepartResult } from "@/lib/search-departs/types";

type Props = {
  organizationId: string;
};

function defaultDateInput(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Smoke test UI pour le moteur de recherche départs (U05). */
export function SearchDepartsSmoke({ organizationId }: Props) {
  const [pending, setPending] = React.useState(false);
  const [results, setResults] = React.useState<SearchDepartResult[] | null>(null);
  const [form, setForm] = React.useState({
    villeDepart: "Kinshasa",
    villeArrivee: "Lubumbashi",
    date: defaultDateInput(),
    modeTransport: "" as "" | "BUS" | "AVION",
    includeComplets: false,
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await searchDepartsAction({
      organizationId,
      villeDepart: form.villeDepart,
      villeArrivee: form.villeArrivee,
      date: form.date,
      modeTransport: form.modeTransport || undefined,
      includeComplets: form.includeComplets,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      setResults([]);
      return;
    }
    setResults(res.data.results);
    if (res.data.results.length === 0) {
      toast.message("Aucun départ pour ces critères.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recherche départs (smoke)</CardTitle>
        <CardDescription>
          Moteur U05 — prix dès, places restantes, mode. Seed : Kinshasa → Lubumbashi
          (mer./sam. bus, ven. avion).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="search-ville-depart">Départ</Label>
            <Input
              id="search-ville-depart"
              className="h-11"
              value={form.villeDepart}
              onChange={(e) => setForm((s) => ({ ...s, villeDepart: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="search-ville-arrivee">Arrivée</Label>
            <Input
              id="search-ville-arrivee"
              className="h-11"
              value={form.villeArrivee}
              onChange={(e) => setForm((s) => ({ ...s, villeArrivee: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="search-date">Date</Label>
            <Input
              id="search-date"
              type="date"
              className="h-11"
              value={form.date}
              onChange={(e) => setForm((s) => ({ ...s, date: e.target.value }))}
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="search-mode">Mode</Label>
            <Select
              id="search-mode"
              className="h-11"
              value={form.modeTransport}
              onChange={(e) =>
                setForm((s) => ({
                  ...s,
                  modeTransport: e.target.value as "" | "BUS" | "AVION",
                }))
              }
            >
              <option value="">Tous</option>
              <option value="BUS">Bus</option>
              <option value="AVION">Avion</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={form.includeComplets}
              onChange={(e) =>
                setForm((s) => ({ ...s, includeComplets: e.target.checked }))
              }
            />
            Inclure les départs complets
          </label>
          <div className="sm:col-span-2">
            <Button type="submit" className="h-11 w-full" disabled={pending}>
              <Search className="size-4" data-icon="inline-start" aria-hidden />
              {pending ? "Recherche…" : "Rechercher"}
            </Button>
          </div>
        </form>

        {results !== null && (
          results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun résultat.</p>
          ) : (
            <ListGroup title={`${results.length} départ${results.length !== 1 ? "s" : ""}`}>
              {results.map((r) => (
                <ListItem
                  key={r.departId}
                  title={`${formatDateFr(r.dateDepart)} · ${r.heureDepart}`}
                  description={`${MODE_TRANSPORT_LABELS[r.modeTransport]} · à partir de ${formatMontantFc(r.prixBase)} · ${r.complet ? "Complet" : `${r.placesRestantes} place${r.placesRestantes !== 1 ? "s" : ""} restante${r.placesRestantes !== 1 ? "s" : ""}`}`}
                  showChevron={false}
                  trailing={
                    r.complet ? (
                      <Badge variant="secondary">Complet</Badge>
                    ) : (
                      <Badge variant="outline">{MODE_TRANSPORT_LABELS[r.modeTransport]}</Badge>
                    )
                  }
                />
              ))}
            </ListGroup>
          )
        )}
      </CardContent>
    </Card>
  );
}
