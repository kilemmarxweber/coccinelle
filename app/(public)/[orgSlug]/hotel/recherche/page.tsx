import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HotelRoomSearch } from "@/components/hotel/hotel-room-search";
import { getPublicHotelBranchForOrg } from "@/lib/hotel/client-online-order";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  return {
    title: org ? `Réserver — ${org.name}` : "Réserver une chambre",
  };
}

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export default async function HotelRoomSearchPage({
  params,
  searchParams,
}: PageProps) {
  const { orgSlug } = await params;
  const sp = await searchParams;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const hotel = await getPublicHotelBranchForOrg(org.id);
  if (!hotel) notFound();

  return (
    <HotelRoomSearch
      orgSlug={org.slug}
      hotelName={hotel.name}
      initialCheckIn={firstParam(sp.checkIn)}
      initialCheckOut={firstParam(sp.checkOut)}
      initialError={firstParam(sp.error) ?? null}
    />
  );
}
