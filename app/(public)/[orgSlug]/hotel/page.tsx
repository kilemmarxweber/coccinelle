import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HotelClientLanding } from "@/components/hotel/hotel-client-landing";
import { getPublicHotelBranchForOrg } from "@/lib/hotel/client-online-order";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) return { title: "Hôtel" };
  return {
    title: `Hôtel — ${org.name}`,
    description: `Espace client hôtel ${org.name} — chambre, table et room service.`,
  };
}

export default async function ClientHotelHomePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const hotel = await getPublicHotelBranchForOrg(org.id);
  if (!hotel) notFound();

  return (
    <HotelClientLanding
      orgSlug={org.slug}
      orgName={org.name}
      hotelName={hotel.name}
    />
  );
}
