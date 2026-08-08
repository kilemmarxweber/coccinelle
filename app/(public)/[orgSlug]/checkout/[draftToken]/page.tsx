import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, Search } from "lucide-react";
import { CheckoutForm } from "@/components/pwa/checkout-form";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCheckoutDraft } from "@/lib/reservation/draft";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";
import {
  OrganizationScopeError,
  getDepartForOrganization,
} from "@/lib/search-departs";

type PageProps = {
  params: Promise<{ orgSlug: string; draftToken: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) return { title: "Organisation introuvable" };
  return {
    title: `Réservation — ${org.name}`,
    description: "Complétez vos passagers et options avant le paiement.",
  };
}

export default async function CheckoutDraftPage({ params }: PageProps) {
  const { orgSlug, draftToken } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const draft = await getCheckoutDraft({
    organizationId: org.id,
    draftToken,
  });
  if (!draft) notFound();

  if (draft.expired) {
    return (
      <EmptyState
        icon={Clock}
        title="Brouillon expiré"
        description="Ce brouillon de réservation n’est plus valable. Relancez une recherche pour choisir un départ."
        action={
          <Button render={<Link href={`/${org.slug}/recherche`} />}>
            <Search data-icon="inline-start" aria-hidden />
            Retour à la recherche
          </Button>
        }
      />
    );
  }

  let depart;
  try {
    depart = await getDepartForOrganization({
      organizationSlug: org.slug,
      departId: draft.payload.trajetDepartId,
    });
  } catch (e) {
    if (e instanceof OrganizationScopeError) notFound();
    throw e;
  }
  if (!depart) notFound();

  const tarifs = {
    prixBase: depart.prixBase,
    prixParKilo: depart.prixParKilo,
    kilosGratuits: depart.kilosGratuits,
  };

  return (
    <CheckoutForm
      orgSlug={org.slug}
      draftToken={draft.draftToken}
      expiresAtIso={draft.expiresAt.toISOString()}
      initialPayload={draft.payload}
      initialPlacesRestantes={draft.placesRestantes}
      tarifs={tarifs}
      depart={{
        departId: depart.departId,
        villeDepart: depart.villeDepart,
        villeArrivee: depart.villeArrivee,
        dateDepart: depart.dateDepart,
        heureDepart: depart.heureDepart,
        placesRestantes: depart.placesRestantes,
        kilosGratuits: depart.kilosGratuits,
        prixParKilo: depart.prixParKilo,
      }}
    />
  );
}
