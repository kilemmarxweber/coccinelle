"use client";

import { Package, Search, Zap } from "lucide-react";
import {
  CheckoutStepper,
  DepartResultCard,
  SearchBar,
} from "@/components/funnel";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { GuichetClientSection } from "./guichet/guichet-client-section";
import { GuichetColisSection } from "./guichet/guichet-colis-section";
import { GuichetPassagersSection } from "./guichet/guichet-passagers-section";
import { GuichetPaiementSelect } from "./guichet/guichet-paiement-select";
import { GuichetPlacesBandeau } from "./guichet/guichet-places-bandeau";
import { GuichetRecap } from "./guichet/guichet-recap";
import { useGuichetForm } from "./guichet/use-guichet-form";
import { GUICHET_STEPS, type GuichetFormProps } from "./guichet/types";

export type { GuichetFormProps } from "./guichet/types";

export function GuichetForm(props: GuichetFormProps) {
  const form = useGuichetForm(props);
  const { step, setStep, express, voyage, search } = form;
  const depart = voyage.selectedDepart;

  return (
    <div className="min-h-screen pb-10">
      <PageHeader
        title={express ? "Vente express" : "Vendre"}
        subtitle={
          express
            ? "Départs du jour · espèces par défaut"
            : "Funnel guichet — recherche → confirmation"
        }
        showBack
      />

      <GuichetPlacesBandeau
        express={express}
        villeDepart={depart?.villeDepart}
        villeArrivee={depart?.villeArrivee}
        placesRestantes={depart?.placesRestantes}
        complet={depart?.complet}
      />

      <div
        className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-4 md:max-w-6xl md:grid-cols-[1fr_320px] md:px-6 lg:grid-cols-[1fr_360px]"
      >
        <div className="flex min-w-0 flex-col gap-6">
          <CheckoutStepper
            steps={GUICHET_STEPS}
            currentStep={step}
            onStepClick={(id) => {
              const target = id as typeof step;
              const currentIndex = GUICHET_STEPS.findIndex((s) => s.id === step);
              const targetIndex = GUICHET_STEPS.findIndex((s) => s.id === target);
              if (targetIndex <= currentIndex) setStep(target);
            }}
          />

          {step === "recherche" && (
            <section className="flex flex-col gap-4" aria-labelledby="guichet-search">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 id="guichet-search" className="text-lg font-semibold">
                  {express ? "Départs du jour" : "Recherche départ"}
                </h2>
                {!express && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      form.passagers.setNombrePlaces(0);
                      form.colis.setInclude(true);
                    }}
                  >
                    <Package data-icon="inline-start" aria-hidden />
                    Colis seul
                  </Button>
                )}
              </div>

              {!express && (
                <SearchBar
                  values={search.values}
                  onChange={search.setValues}
                  onSubmit={search.submit}
                  pending={search.pending}
                  idPrefix="guichet-search"
                />
              )}

              {express && search.pending && (
                <p className="text-sm text-muted-foreground">
                  Chargement des départs du jour…
                </p>
              )}

              {search.results === null && !express ? (
                <Card>
                  <CardContent className="pt-0">
                    <EmptyState
                      icon={Search}
                      title="Lancez une recherche"
                      description="Ville de départ, arrivée et date pour afficher les départs."
                    />
                  </CardContent>
                </Card>
              ) : search.results && search.results.length === 0 ? (
                <Card>
                  <CardContent className="pt-0">
                    <EmptyState
                      icon={express ? Zap : Search}
                      title={
                        express
                          ? "Aucun départ aujourd’hui"
                          : "Aucun départ"
                      }
                      description={
                        express
                          ? "Aucun trajet planifié pour aujourd’hui, ou tous complets exclus."
                          : "Essayez une autre date ou un autre trajet."
                      }
                    />
                  </CardContent>
                </Card>
              ) : (
                <ul className="flex flex-col gap-3">
                  {(search.results ?? []).map((d) => (
                    <li key={d.departId}>
                      <DepartResultCard
                        depart={d}
                        selected={depart?.departId === d.departId}
                        onSelect={voyage.selectDepart}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {step === "client" && (
            <div className="flex flex-col gap-4">
              <GuichetClientSection form={form} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("recherche")}
                >
                  Retour
                </Button>
                <Button type="button" onClick={form.client.goNext}>
                  Continuer
                </Button>
              </div>
            </div>
          )}

          {step === "passagers" && (
            <div className="flex flex-col gap-4">
              <GuichetPassagersSection form={form} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("client")}
                >
                  Retour
                </Button>
                <Button type="button" onClick={form.passagers.goNext}>
                  Continuer
                </Button>
              </div>
            </div>
          )}

          {step === "colis" && (
            <div className="flex flex-col gap-4">
              <GuichetColisSection form={form} />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("passagers")}
                >
                  Retour
                </Button>
                {form.passagers.nombrePlaces > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={form.colis.skip}
                  >
                    Continuer sans colis
                  </Button>
                )}
                <Button
                  type="button"
                  onClick={() => {
                    if (!form.colis.show) {
                      form.colis.setInclude(true);
                      return;
                    }
                    form.colis.goNext();
                  }}
                >
                  {form.colis.show ? "Continuer" : "Ajouter un colis"}
                </Button>
              </div>
            </div>
          )}

          {step === "paiement" && (
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Paiement</CardTitle>
                  <CardDescription>
                    {express
                      ? "Espèces sélectionnées par défaut (vente express)."
                      : "Espèces → réservation confirmée et paiement marqué payé."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GuichetPaiementSelect
                    value={form.paiement.mode}
                    onChange={form.paiement.setMode}
                  />
                </CardContent>
              </Card>
              <div className="flex flex-wrap gap-2 md:hidden">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep("colis")}
                >
                  Retour
                </Button>
                <Button
                  type="button"
                  disabled={form.submitting || !form.pricing}
                  onClick={() => form.handleSubmit()}
                >
                  {form.submitting ? "Création…" : "Confirmer la réservation"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <GuichetRecap form={form} />
      </div>
    </div>
  );
}
