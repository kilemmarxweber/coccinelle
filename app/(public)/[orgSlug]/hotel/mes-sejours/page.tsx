import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { BedDouble } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { auth } from "@/lib/auth";
import { clientHotelRoutes } from "@/lib/branch/paths";
import { listMyHotelStaysForOrg } from "@/lib/hotel/client-stays";
import { formatStayDateFr } from "@/lib/hotel/folio-nights";
import {
  HOTEL_STAY_STATUS_BADGE_CLASS,
  HOTEL_STAY_STATUS_LABELS,
} from "@/lib/hotel/stay-status";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";
import { formatMontantFc } from "@/lib/reservation/labels";
import { cn } from "@/lib/utils";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  return {
    title: org ? `Mes séjours — ${org.name}` : "Mes séjours",
  };
}

export default async function MesSejoursHotelPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(
      `/auth/sign-in?callbackUrl=${encodeURIComponent(
        clientHotelRoutes.mesSejours(org.slug),
      )}`,
    );
  }

  const list = await listMyHotelStaysForOrg(org.id);
  if (list === null) {
    redirect(
      `/auth/sign-in?callbackUrl=${encodeURIComponent(
        clientHotelRoutes.mesSejours(org.slug),
      )}`,
    );
  }

  if (list.length === 0) {
    return (
      <EmptyState
        icon={BedDouble}
        title="Aucun séjour"
        description="Vos réservations de chambre en ligne apparaîtront ici."
        action={
          <Button
            render={<Link href={clientHotelRoutes.recherche(org.slug)} />}
          >
            Réserver une chambre
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 py-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mes séjours</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uniquement les séjours liés à ce compte.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {list.map((s) => (
          <li key={s.id}>
            <Link
              href={clientHotelRoutes.mesSejour(org.slug, s.id)}
              className="block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="transition hover:border-primary/40">
                <CardHeader className="pb-2">
                  <CardDescription className="font-mono">
                    {s.codeUnique}
                  </CardDescription>
                  <CardTitle className="text-base">{s.roomTypeName}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>
                    {formatStayDateFr(s.checkInDate)} →{" "}
                    {formatStayDateFr(s.checkOutDate)}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(HOTEL_STAY_STATUS_BADGE_CLASS[s.status])}
                  >
                    {HOTEL_STAY_STATUS_LABELS[s.status]}
                  </Badge>
                  <span className="ms-auto font-medium text-foreground tabular-nums">
                    {formatMontantFc(s.totalAmount)}
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
