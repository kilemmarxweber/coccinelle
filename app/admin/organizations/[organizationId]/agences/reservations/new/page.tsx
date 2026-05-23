import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function NewReservationRedirectPage({ params }: PageProps) {
  const { organizationId } = await params;
  redirect(`/admin/organizations/${organizationId}/agences/reservations/guichet`);
}
