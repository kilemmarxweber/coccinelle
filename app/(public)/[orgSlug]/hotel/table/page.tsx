import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HotelTableReservationFunnel } from "@/components/hotel/hotel-table-reservation-funnel";
import {
  getPublicHotelBranchForOrg,
} from "@/lib/hotel/client-online-order";
import { listMenuCategories } from "@/lib/hotel/list-fnb";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) return { title: "Réserver une table" };
  return {
    title: `Réserver une table — ${org.name}`,
    description: `Réservation de table en ligne — ${org.name}.`,
  };
}

export default async function ClientHotelTablePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const hotel = await getPublicHotelBranchForOrg(org.id);
  if (!hotel) notFound();

  const categories = await listMenuCategories(hotel.id);

  return (
    <HotelTableReservationFunnel
      orgSlug={org.slug}
      organizationId={org.id}
      hotelName={hotel.name}
      categories={categories}
    />
  );
}
