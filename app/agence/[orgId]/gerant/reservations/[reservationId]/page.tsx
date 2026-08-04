import Link from "next/link";
import {
  GerantReservationDetailView,
  type GerantReservationDetailData,
} from "@/components/agence/gerant-reservation-detail-view";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getReservationAction } from "@/app/admin/organizations/[organizationId]/agences/reservations/actions";
import { gerantPath } from "@/lib/agence/routes";

type PageProps = {
  params: Promise<{ orgId: string; reservationId: string }>;
};

export default async function GerantReservationDetailPage({
  params,
}: PageProps) {
  const { orgId, reservationId } = await params;
  const listHref = gerantPath(orgId, "reservations");
  const result = await getReservationAction(orgId, reservationId);

  if (!result.ok) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="Réservation" subtitle={result.message} showBack />
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Button variant="outline" render={<Link href={listHref} />}>
            Retour aux réservations
          </Button>
        </div>
      </div>
    );
  }

  const r = result.data;
  const clientParts = [
    r.client.prenom,
    r.client.user.name?.split(" ")[0],
    r.client.postnom,
  ].filter(Boolean);

  const reservation: GerantReservationDetailData = {
    id: r.id,
    codeUnique: r.codeUnique,
    statut: r.statut,
    source: r.source,
    prixBillet: r.prixBillet,
    prixTotal: r.prixTotal,
    nombrePlaces: r.nombrePlaces,
    dateDepart: r.dateDepart.toISOString(),
    heureDepart: r.heureDepart,
    createdAt: r.createdAt.toISOString(),
    client: {
      label: clientParts[0]
        ? clientParts.join(" ")
        : r.client.user.email,
      email: r.client.user.email,
      telephone: r.client.telephone,
    },
    trajet: {
      villeDepart: r.trajet.villeDepart,
      villeArrivee: r.trajet.villeArrivee,
      modeTransport: r.trajet.modeTransport,
    },
    passagers: r.passagers.map((p) => ({
      id: p.id,
      nom: p.nom,
      prenom: p.prenom,
      categorie: p.categorie,
      prix: p.prix,
      codeUnique: p.codeUnique,
    })),
    paiements: r.paiements.map((p) => ({
      id: p.id,
      codeUnique: p.codeUnique,
      montant: p.montant,
      methode: p.methode,
      statut: p.statut,
      createdAt: p.createdAt.toISOString(),
    })),
  };

  return (
    <GerantReservationDetailView
      organizationId={orgId}
      reservation={reservation}
    />
  );
}
