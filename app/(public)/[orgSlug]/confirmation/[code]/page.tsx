import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Ticket } from "lucide-react";
import { TicketPrintActions } from "@/components/ticket/ticket-print-actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  buildTicketFromReservation,
  getMyReservationByCodeForOrg,
} from "@/lib/pwa/client-reservations";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";
import {
  formatDateFr,
  formatMontantFc,
  STATUT_RESERVATION_LABELS,
} from "@/lib/reservation/labels";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

type PageProps = {
  params: Promise<{ orgSlug: string; code: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  return {
    title: `Confirmation ${code}`,
    description: "Votre réservation est confirmée.",
  };
}

export default async function ConfirmationPage({ params }: PageProps) {
  const { orgSlug, code } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(
      `/auth/sign-in?callbackUrl=${encodeURIComponent(`/${org.slug}/confirmation/${code}`)}`,
    );
  }

  const reservation = await getMyReservationByCodeForOrg({
    organizationId: org.id,
    codeUnique: code,
  });
  if (!reservation) notFound();

  const ticket = await buildTicketFromReservation(reservation);
  const paiement = reservation.paiements[0];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <CheckCircle2 className="size-12 text-primary" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight">Réservation confirmée</h1>
        <p className="text-sm text-muted-foreground">
          Merci — votre paiement a été enregistré et vos billets sont prêts.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription>Code réservation</CardDescription>
          <CardTitle className="font-mono text-2xl tracking-wide">
            {reservation.codeUnique}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            {reservation.trajet.villeDepart} → {reservation.trajet.villeArrivee}
          </p>
          <p className="text-muted-foreground">
            {formatDateFr(reservation.dateDepart)} · {reservation.heureDepart}
          </p>
          <p>
            Statut ·{" "}
            {STATUT_RESERVATION_LABELS[reservation.statut] ?? reservation.statut}
            {paiement ? ` · Paiement ${paiement.statut}` : null}
          </p>
          <p className="font-medium">{formatMontantFc(reservation.prixTotal)}</p>
        </CardContent>
      </Card>

      <Alert>
        <Ticket className="size-4" aria-hidden />
        <AlertTitle>Billet & QR</AlertTitle>
        <AlertDescription>
          Chaque passager dispose d’un code et d’un QR scannable. Conservez ou
          imprimez votre billet.
        </AlertDescription>
      </Alert>

      <TicketPrintActions ticket={ticket} />

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="outline"
          className="h-11 flex-1"
          render={<Link href={`/${org.slug}/mes-reservations/${reservation.id}`} />}
        >
          Voir le détail
        </Button>
        <Button
          className="h-11 flex-1"
          render={<Link href={`/${org.slug}/mes-reservations`} />}
        >
          Mes réservations
        </Button>
      </div>
    </div>
  );
}
