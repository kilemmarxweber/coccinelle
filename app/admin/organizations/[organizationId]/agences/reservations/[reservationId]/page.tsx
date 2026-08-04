import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { generatePassengerQr } from "@/lib/reservation/passenger-qr";
import { ReservationDetail } from "../components/reservation-detail";
import { getReservationAction } from "../actions";

/** Segments réservés (ne sont pas des ids de réservation). */
const RESERVED_SEGMENTS = new Set(["nouveau", "new", "guichet", "create"]);

type PageProps = {
  params: Promise<{ organizationId: string; reservationId: string }>;
};

export default async function ReservationDetailPage({ params }: PageProps) {
  const { organizationId, reservationId } = await params;

  if (RESERVED_SEGMENTS.has(reservationId)) {
    redirect(`/admin/organizations/${organizationId}/agences/reservations/guichet`);
  }

  const result = await getReservationAction(organizationId, reservationId);

  if (!result.ok) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Réservation" subtitle={result.message} showBack />
        <div className="mx-auto max-w-2xl px-4 py-8 md:max-w-4xl md:px-6">
          <Button
            variant="outline"
            render={
              <Link
                href={`/admin/organizations/${organizationId}/agences/reservations`}
              />
            }
          >
            Retour aux réservations
          </Button>
        </div>
      </div>
    );
  }

  const r = result.data;
  const passagers = await Promise.all(
    r.passagers.map(async (p) => {
      const qr = await generatePassengerQr(p.codeUnique);
      return {
        id: p.id,
        nom: p.nom,
        prenom: p.prenom,
        categorie: p.categorie,
        prix: p.prix,
        codeUnique: p.codeUnique,
        occupePlace: p.occupePlace,
        qrDataUrl: qr.dataUrl,
        qrPayload: qr.payload,
      };
    }),
  );

  const reservation = {
    id: r.id,
    codeUnique: r.codeUnique,
    statut: r.statut,
    source: r.source,
    prixBillet: r.prixBillet,
    prixTotal: r.prixTotal,
    nombrePlaces: r.nombrePlaces,
    penalite: r.penalite,
    peutReporter: r.peutReporter,
    dateLimiteReport: r.dateLimiteReport?.toISOString() ?? null,
    dateDepart: r.dateDepart.toISOString(),
    heureDepart: r.heureDepart,
    createdAt: r.createdAt.toISOString(),
    client: {
      user: r.client.user,
      telephone: r.client.telephone,
      prenom: r.client.prenom,
      postnom: r.client.postnom,
    },
    organization: {
      name: r.trajet.organization.name,
      logo: r.trajet.organization.logo,
    },
    trajet: {
      villeDepart: r.trajet.villeDepart,
      villeArrivee: r.trajet.villeArrivee,
      modeTransport: r.trajet.modeTransport,
    },
    passagers,
    colis: r.colis.map((c) => ({
      id: c.id,
      codeUnique: c.codeUnique,
      type: c.type,
      poids: c.poids,
      montantAPayer: c.montantAPayer,
      destinataireNom: c.destinataireNom,
      destinataireTel: c.destinataireTel,
      destinataireId: c.destinataireId,
    })),
    paiements: r.paiements.map((pay) => ({
      id: pay.id,
      statut: pay.statut,
      methode: pay.methode,
      montant: pay.montant,
      codeUnique: pay.codeUnique,
    })),
  };

  return (
    <ReservationDetail organizationId={organizationId} reservation={reservation} />
  );
}
