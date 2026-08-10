import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { HotelPublicHeader } from "@/components/hotel/hotel-public-header";
import { getPublicHotelBranchForOrg } from "@/lib/hotel/client-online-order";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type Props = {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
};

/** Client hôtel : header propre (override Voyage) + largeur pour landing images. */
export default async function ClientHotelLayout({ children, params }: Props) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const hotel = await getPublicHotelBranchForOrg(org.id);
  if (!hotel) notFound();

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-12 pt-4 sm:px-6">
      <HotelPublicHeader orgSlug={org.slug} hotelName={hotel.name} />
      {children}
    </div>
  );
}
