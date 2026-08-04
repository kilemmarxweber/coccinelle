import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { listMyReservationsForOrg } from "@/lib/pwa/client-reservations";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";
import {
  formatDateFr,
  formatMontantFc,
  STATUT_PAIEMENT_LABELS,
  STATUT_RESERVATION_LABELS,
} from "@/lib/reservation/labels";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  return {
    title: org ? `Mes réservations — ${org.name}` : "Mes réservations",
  };
}

export default async function MesReservationsPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(
      `/auth/sign-in?callbackUrl=${encodeURIComponent(`/${org.slug}/mes-reservations`)}`,
    );
  }

  const list = await listMyReservationsForOrg(org.id);
  if (list === null) {
    redirect(
      `/auth/sign-in?callbackUrl=${encodeURIComponent(`/${org.slug}/mes-reservations`)}`,
    );
  }

  if (list.length === 0) {
    return (
      <EmptyState
        icon={Ticket}
        title="Aucune réservation"
        description="Vos billets achetés en ligne apparaîtront ici."
        action={
          <Button render={<Link href={`/${org.slug}/recherche`} />}>
            Rechercher un départ
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mes réservations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uniquement vos billets liés à ce compte.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {list.map((r) => (
          <li key={r.id}>
            <Link
              href={`/${org.slug}/mes-reservations/${r.id}`}
              className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="transition hover:border-primary/40">
                <CardHeader className="pb-2">
                  <CardDescription className="font-mono">
                    {r.codeUnique}
                  </CardDescription>
                  <CardTitle className="text-base">
                    {r.villeDepart} → {r.villeArrivee}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    {formatDateFr(r.dateDepart)} · {r.heureDepart}
                  </span>
                  <span>
                    {STATUT_RESERVATION_LABELS[r.statut] ?? r.statut}
                  </span>
                  {r.paiementStatut ? (
                    <span>
                      {STATUT_PAIEMENT_LABELS[r.paiementStatut] ??
                        r.paiementStatut}
                    </span>
                  ) : null}
                  <span className="ms-auto font-medium text-foreground">
                    {formatMontantFc(r.prixTotal)}
                  </span>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
