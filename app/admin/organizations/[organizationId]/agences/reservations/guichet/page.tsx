import { GuichetHome } from "../components/guichet-home";
import { getReservationsAction } from "../actions";
import { assertInscriptionPermission } from "@/lib/auth/inscription-permission";
import type { ReservationListItem } from "../components/reservations-list";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function GuichetHomePage({ params }: PageProps) {
  const { organizationId } = await params;

  const sellPerm = await assertInscriptionPermission(organizationId, "ajouter");
  const listResult = await getReservationsAction(organizationId);

  const lastSales: ReservationListItem[] =
    listResult.ok
      ? (listResult.data.slice(0, 5) as ReservationListItem[])
      : [];

  return (
    <GuichetHome
      organizationId={organizationId}
      canSell={sellPerm.ok}
      denyMessage={sellPerm.ok ? undefined : sellPerm.message}
      lastSales={lastSales}
    />
  );
}
