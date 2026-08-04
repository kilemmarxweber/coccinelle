import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { TicketPrintActions } from "@/components/ticket/ticket-print-actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  buildTicketFromReservation,
  getMyReservationForOrg,
} from "@/lib/pwa/client-reservations";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";
import {
  CATEGORIE_PASSAGER_LABELS,
  formatDateFr,
  formatMontantFc,
  METHODE_PAIEMENT_LABELS,
  SOURCE_RESERVATION_LABELS,
  STATUT_PAIEMENT_LABELS,
  STATUT_RESERVATION_LABELS,
} from "@/lib/reservation/labels";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

type PageProps = {
  params: Promise<{ orgSlug: string; id: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Réservation ${id.slice(0, 8)}` };
}

export default async function MesReservationDetailPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(
      `/auth/sign-in?callbackUrl=${encodeURIComponent(`/${org.slug}/mes-reservations/${id}`)}`,
    );
  }

  const reservation = await getMyReservationForOrg({
    organizationId: org.id,
    reservationId: id,
  });
  if (!reservation) notFound();

  const ticket = await buildTicketFromReservation(reservation);
  const paiement = reservation.paiements[0];

  return (
    <div className="flex flex-col gap-6">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="self-start"
        render={<Link href={`/${org.slug}/mes-reservations`} />}
      >
        <ArrowLeft data-icon="inline-start" aria-hidden />
        Mes réservations
      </Button>

      <div>
        <p className="font-mono text-sm text-muted-foreground">
          {reservation.codeUnique}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {reservation.trajet.villeDepart} → {reservation.trajet.villeArrivee}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatDateFr(reservation.dateDepart)} · {reservation.heureDepart}
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Statut</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            Réservation ·{" "}
            {STATUT_RESERVATION_LABELS[reservation.statut] ?? reservation.statut}
          </p>
          <p>
            Source ·{" "}
            {SOURCE_RESERVATION_LABELS[reservation.source] ?? reservation.source}
          </p>
          {paiement ? (
            <p>
              Paiement ·{" "}
              {STATUT_PAIEMENT_LABELS[paiement.statut] ?? paiement.statut}
              {" · "}
              {METHODE_PAIEMENT_LABELS[paiement.methode] ?? paiement.methode}
              {" · "}
              {formatMontantFc(paiement.montant)}
            </p>
          ) : null}
          {paiement?.reference ? (
            <p className="text-muted-foreground">
              Réf. · {paiement.reference}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Passagers</CardTitle>
          <CardDescription>
            Codes et QR disponibles à l’impression
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {reservation.passagers.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-2 text-sm">
              <div>
                <p className="font-medium">
                  {p.prenom} {p.nom}
                </p>
                <p className="text-muted-foreground">
                  {CATEGORIE_PASSAGER_LABELS[p.categorie] ?? p.categorie}
                  {!p.occupePlace ? " · sans siège" : ""}
                </p>
              </div>
              <p className="font-mono text-xs text-muted-foreground">
                {p.codeUnique}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Billet
        </h2>
        <TicketPrintActions ticket={ticket} />
      </div>

      <Separator />

      <Button
        variant="outline"
        className="h-11"
        render={<Link href={`/${org.slug}/confirmation/${reservation.codeUnique}`} />}
      >
        Voir la confirmation
      </Button>
    </div>
  );
}
