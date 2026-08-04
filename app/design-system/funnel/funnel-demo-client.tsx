"use client";

import * as React from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { toast } from "sonner";
import {
  CheckoutStepper,
  DepartResultCard,
  FUNNEL_STEPS,
  PassengerForm,
  PriceSummary,
  SearchBar,
  type FunnelStepId,
  type PassengerFormValues,
  type SearchBarValues,
} from "@/components/funnel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";
import { searchDepartsDemoAction } from "@/lib/search-departs/demo-action";
import type { SearchDepartResult } from "@/lib/search-departs/types";

function nextWeekdayIso(targetDay: number): string {
  const date = new Date();
  const diff = (targetDay - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + diff);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Tarifs de secours alignés sur le seed Kin→Lubumbashi bus. */
const DEMO_TARIFS = {
  prixBase: 45,
  prixParKilo: 3,
  kilosGratuits: 20,
};

export function FunnelDemoClient() {
  const [step, setStep] = React.useState<FunnelStepId>("recherche");
  const [pending, setPending] = React.useState(false);
  const [results, setResults] = React.useState<SearchDepartResult[] | null>(null);
  const [selected, setSelected] = React.useState<SearchDepartResult | null>(null);
  const [adultCount, setAdultCount] = React.useState(1);
  const [passenger, setPassenger] = React.useState<PassengerFormValues>({
    prenom: "",
    nom: "",
    sexe: "M",
    categorie: "ADULTE",
    telephone: "",
  });
  const [search, setSearch] = React.useState<SearchBarValues>({
    villeDepart: "Kinshasa",
    villeArrivee: "Lubumbashi",
    date: nextWeekdayIso(3),
    modeTransport: "",
  });

  const tarifs = selected
    ? {
        prixBase: selected.prixBase,
        prixParKilo: selected.prixParKilo,
        kilosGratuits: selected.kilosGratuits,
      }
    : DEMO_TARIFS;

  async function handleSearch(values: SearchBarValues) {
    setPending(true);
    setSelected(null);
    const res = await searchDepartsDemoAction({
      villeDepart: values.villeDepart,
      villeArrivee: values.villeArrivee,
      date: values.date,
      modeTransport: values.modeTransport || undefined,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      setResults([]);
      return;
    }
    setResults(res.data.results);
    setStep("recherche");
    if (res.data.results.length === 0) {
      toast.message("Aucun départ pour ces critères.");
    }
  }

  function handleSelectDepart(depart: SearchDepartResult) {
    setSelected(depart);
    setStep("passagers");
  }

  return (
    <div className="min-h-screen pb-10">
      <PageHeader title="Funnel airline" subtitle="Kit composants U06" showBack />

      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4 pb-4">
            <p className="text-sm text-muted-foreground">
              Démo branchée sur le moteur U05 (org seed{" "}
              <code className="text-foreground">default-org</code>). Seed : Kinshasa →
              Lubumbashi, mercredi/samedi bus, vendredi avion.
            </p>
          </CardContent>
        </Card>

        <CheckoutStepper
          steps={FUNNEL_STEPS}
          currentStep={step}
          onStepClick={(id) => setStep(id as FunnelStepId)}
        />

        <section className="flex flex-col gap-3" aria-labelledby="funnel-search-heading">
          <h2 id="funnel-search-heading" className="text-lg font-semibold">
            Recherche
          </h2>
          <SearchBar
            values={search}
            onChange={setSearch}
            onSubmit={handleSearch}
            pending={pending}
          />
        </section>

        <section className="flex flex-col gap-3" aria-labelledby="funnel-results-heading">
          <h2 id="funnel-results-heading" className="text-lg font-semibold">
            Résultats
          </h2>
          {results === null ? (
            <Card>
              <CardContent className="pt-0">
                <EmptyState
                  icon={Search}
                  title="Lancez une recherche"
                  description="Utilisez la barre ci-dessus pour afficher les départs seedés."
                />
              </CardContent>
            </Card>
          ) : results.length === 0 ? (
            <Card>
              <CardContent className="pt-0">
                <EmptyState
                  icon={Search}
                  title="Aucun départ"
                  description="Aucun résultat pour ces critères. Essayez un mercredi (bus) ou vendredi (avion)."
                />
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {results.map((depart) => (
                <DepartResultCard
                  key={depart.departId}
                  depart={depart}
                  selected={selected?.departId === depart.departId}
                  onSelect={handleSelectDepart}
                />
              ))}
            </div>
          )}
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Passager (base)</CardTitle>
              <CardDescription>
                Formulaire réutilisable — hors parcours guichet complet.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PassengerForm values={passenger} onChange={setPassenger} />
            </CardContent>
          </Card>

          <PriceSummary
            tarifs={tarifs}
            adultCount={adultCount}
            onAdultCountChange={setAdultCount}
            description={
              selected
                ? `${selected.villeDepart} → ${selected.villeArrivee}`
                : "Tarifs mock jusqu’à sélection d’un départ"
            }
          />
        </div>

        <Button type="button" variant="outline" render={<Link href="/design-system" />}>
          Retour design system
        </Button>
      </div>
    </div>
  );
}
