import { GuichetForm } from "../components/guichet-form";
import { GuichetEmpty } from "../components/guichet-empty";
import { getTrajetsForOrganizationAction } from "../../trajets/actions";
import { PageHeader } from "@/components/layout/page-header";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function GuichetReservationPage({ params }: PageProps) {
  const { organizationId } = await params;
  const trajetsResult = await getTrajetsForOrganizationAction(organizationId);
  const listHref = `/admin/organizations/${organizationId}/agences/reservations`;
  const trajetsHref = `/admin/organizations/${organizationId}/agences/trajets`;

  if (!trajetsResult.ok) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Guichet" subtitle={trajetsResult.message} showBack />
        <div className="mx-auto max-w-2xl px-4 py-8 md:max-w-4xl md:px-6">
          <Button variant="outline" render={<Link href={listHref} />}>
            Retour aux réservations
          </Button>
        </div>
      </div>
    );
  }

  const hasBookableTrajet = trajetsResult.data.some((t) => t.departs.length > 0);

  if (!hasBookableTrajet) {
    return (
      <div className="min-h-screen">
        <PageHeader
          title="Guichet"
          subtitle="Aucun départ disponible"
          showBack
        />
        <GuichetEmpty
          organizationId={organizationId}
          listHref={listHref}
          trajetsHref={trajetsHref}
        />
      </div>
    );
  }

  return (
    <GuichetForm
      organizationId={organizationId}
      trajets={trajetsResult.data.filter((t) => t.departs.length > 0)}
    />
  );
}
