import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Search } from "lucide-react";
import { CheckoutStepper, FUNNEL_STEPS } from "@/components/funnel";
import { PwaResultsList } from "@/components/pwa/pwa-results-list";
import { PwaSearchForm } from "@/components/pwa/pwa-search-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";
import {
  OrganizationScopeError,
  searchDeparts,
} from "@/lib/search-departs";
import type { SearchBarValues } from "@/components/funnel";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{
    from?: string;
    to?: string;
    date?: string;
    mode?: string;
  }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) return { title: "Organisation introuvable" };
  return {
    title: `Résultats — ${org.name}`,
    description: `Départs disponibles chez ${org.name}.`,
  };
}

function parseMode(mode: string | undefined): "" | "BUS" | "AVION" {
  if (mode === "BUS" || mode === "AVION") return mode;
  return "";
}

export default async function OrgRecherchePage({
  params,
  searchParams,
}: PageProps) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const sp = await searchParams;
  const from = (sp.from ?? "").trim();
  const to = (sp.to ?? "").trim();
  const date = (sp.date ?? "").trim();
  const modeTransport = parseMode(sp.mode);
  const hasCriteria = Boolean(from && to && date);

  const initial: Partial<SearchBarValues> = {
    villeDepart: from || undefined,
    villeArrivee: to || undefined,
    date: date || undefined,
    modeTransport,
  };

  let results: Awaited<ReturnType<typeof searchDeparts>>["results"] | null =
    null;
  let searchError: string | null = null;

  if (hasCriteria) {
    try {
      const data = await searchDeparts({
        organizationSlug: org.slug,
        villeDepart: from,
        villeArrivee: to,
        date,
        modeTransport: modeTransport || undefined,
      });
      results = data.results;
    } catch (e) {
      if (e instanceof OrganizationScopeError) {
        notFound();
      }
      searchError =
        e instanceof Error ? e.message : "Recherche impossible.";
      results = [];
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          render={<Link href={`/${org.slug}`} />}
        >
          <ArrowLeft data-icon="inline-start" aria-hidden />
          Accueil
        </Button>
      </div>

      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Résultats</h1>
        <p className="text-sm text-muted-foreground">
          {hasCriteria
            ? `${from} → ${to}${modeTransport ? ` · ${modeTransport === "AVION" ? "Avion" : "Bus"}` : ""}`
            : "Affinez votre recherche pour voir les départs."}
        </p>
      </section>

      <CheckoutStepper steps={FUNNEL_STEPS} currentStep="recherche" />

      <PwaSearchForm
        orgSlug={org.slug}
        initial={initial}
        idPrefix="pwa-recherche"
      />

      <section
        className="flex flex-col gap-3"
        aria-labelledby="pwa-results-heading"
      >
        <h2 id="pwa-results-heading" className="text-lg font-semibold">
          Départs
        </h2>

        {!hasCriteria ? (
          <EmptyState
            icon={Search}
            title="Lancez une recherche"
            description="Indiquez départ, arrivée et date pour afficher les trajets."
          />
        ) : searchError ? (
          <EmptyState
            icon={Search}
            title="Erreur"
            description={searchError}
          />
        ) : results && results.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Aucun départ"
            description="Aucun résultat pour ces critères. Essayez une autre date ou un autre mode (bus / avion)."
          />
        ) : results ? (
          <PwaResultsList orgSlug={org.slug} results={results} />
        ) : null}
      </section>
    </div>
  );
}
