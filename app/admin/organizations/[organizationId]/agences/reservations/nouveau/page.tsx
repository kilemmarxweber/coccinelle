import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ organizationId: string }> };

/** Ancienne URL — évite le conflit avec `[reservationId]`. */
export default async function NouvelleReservationRedirectPage({ params }: PageProps) {
  const { organizationId } = await params;
  redirect(`/admin/organizations/${organizationId}/agences/reservations/guichet`);
}
