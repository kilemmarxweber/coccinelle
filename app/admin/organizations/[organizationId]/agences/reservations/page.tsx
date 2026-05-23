import { ReservationsList } from "./components/reservations-list";
import { getReservationsAction } from "./actions";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function ReservationsPage({ params }: PageProps) {
  const { organizationId } = await params;
  const result = await getReservationsAction(organizationId);

  if (!result.ok) {
    return (
      <ReservationsList reservations={[]} errorMessage={result.message} />
    );
  }

  const reservations = result.data.map((r) => ({
    ...r,
    dateDepart: r.dateDepart.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));

  return <ReservationsList reservations={reservations} />;
}
