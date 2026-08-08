import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HotelTableReservationConfirmation } from "@/components/hotel/hotel-table-reservation-confirmation";
import { getPublicTableReservation } from "@/lib/hotel/list-table-reservations";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type PageProps = {
  params: Promise<{ orgSlug: string; reservationId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) return { title: "Confirmation table" };
  return {
    title: `Confirmation table — ${org.name}`,
  };
}

export default async function ClientHotelTableConfirmationPage({
  params,
}: PageProps) {
  const { orgSlug, reservationId } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const reservation = await getPublicTableReservation(org.id, reservationId);
  if (!reservation) notFound();

  return (
    <HotelTableReservationConfirmation
      orgSlug={org.slug}
      hotelName={reservation.branchName}
      reservation={reservation}
    />
  );
}
