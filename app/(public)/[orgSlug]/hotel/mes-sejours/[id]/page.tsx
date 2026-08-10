import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { clientHotelRoutes } from "@/lib/branch/paths";
import { getMyHotelStayForOrg } from "@/lib/hotel/client-stays";
import { formatStayDateFr } from "@/lib/hotel/folio-nights";
import {
  HOTEL_STAY_STATUS_BADGE_CLASS,
  HOTEL_STAY_STATUS_LABELS,
  guestDisplayName,
  type HotelStayStatusValue,
} from "@/lib/hotel/stay-status";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";
import {
  formatMontantFc,
  METHODE_PAIEMENT_LABELS,
} from "@/lib/reservation/labels";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ orgSlug: string; id: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Détail séjour" };
}

export default async function MesSejourDetailPage({ params }: PageProps) {
  const { orgSlug, id } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(
      clientHotelRoutes.connexionWithCallback(
        org.slug,
        clientHotelRoutes.mesSejour(org.slug, id),
      ),
    );
  }

  const stay = await getMyHotelStayForOrg({
    organizationId: org.id,
    stayId: id,
  });
  if (!stay) notFound();

  const status = stay.status as HotelStayStatusValue;
  const paid = stay.payments
    .filter((p) => p.status === "PAYE")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="flex flex-col gap-6 py-2">
      <div>
        <p className="font-mono text-sm text-muted-foreground">
          {stay.codeUnique}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {stay.roomType.name}
        </h1>
        <Badge
          variant="outline"
          className={cn("mt-2", HOTEL_STAY_STATUS_BADGE_CLASS[status])}
        >
          {HOTEL_STAY_STATUS_LABELS[status]}
        </Badge>
      </div>

      <section className="rounded-xl border bg-card/60 p-4 text-sm sm:p-5">
        <p className="font-semibold">
          {guestDisplayName(stay.guestPrenom, stay.guestNom)}
        </p>
        <p className="text-muted-foreground">{stay.guestPhone}</p>
        <p className="mt-3">
          {formatStayDateFr(stay.checkInDate)} →{" "}
          {formatStayDateFr(stay.checkOutDate)}
        </p>
        {stay.room?.number ? (
          <p className="mt-1">Chambre {stay.room.number}</p>
        ) : null}
        <p className="mt-3 text-muted-foreground">{stay.branch.name}</p>
      </section>

      <section className="rounded-xl border bg-card/60 p-4 text-sm sm:p-5">
        <h2 className="font-semibold">Folio</h2>
        <ul className="mt-3 space-y-2">
          {stay.folioLines.map((line) => (
            <li key={line.id} className="flex justify-between gap-2">
              <span>{line.label}</span>
              <span className="tabular-nums text-muted-foreground">
                {formatMontantFc(line.amount)}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-3 flex justify-between border-t pt-3 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">
            {formatMontantFc(stay.totalAmount)}
          </span>
        </div>
        <div className="mt-1 flex justify-between text-muted-foreground">
          <span>Payé</span>
          <span className="tabular-nums">{formatMontantFc(paid)}</span>
        </div>
      </section>

      {stay.payments.length > 0 ? (
        <section className="rounded-xl border bg-card/60 p-4 text-sm sm:p-5">
          <h2 className="font-semibold">Paiements</h2>
          <ul className="mt-3 space-y-2">
            {stay.payments.map((p) => (
              <li key={p.id} className="flex justify-between gap-2">
                <span>
                  {METHODE_PAIEMENT_LABELS[p.method] ?? p.method}
                  {p.reference ? (
                    <span className="block text-xs text-muted-foreground">
                      {p.reference}
                    </span>
                  ) : null}
                </span>
                <span className="tabular-nums">
                  {formatMontantFc(p.amount)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Button
        variant="outline"
        render={<Link href={clientHotelRoutes.mesSejours(org.slug)} />}
        className="w-full sm:w-auto"
      >
        Retour à mes séjours
      </Button>
    </div>
  );
}
