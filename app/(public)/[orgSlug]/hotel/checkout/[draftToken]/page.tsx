import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HotelRoomBookingFunnel } from "@/components/hotel/hotel-room-booking-funnel";
import { getPublicHotelBranchForOrg } from "@/lib/hotel/client-online-order";
import { getHotelStayDraft } from "@/lib/hotel/stay-draft";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type PageProps = {
  params: Promise<{ orgSlug: string; draftToken: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  return {
    title: org ? `Checkout chambre — ${org.name}` : "Checkout chambre",
  };
}

export default async function HotelRoomCheckoutPage({ params }: PageProps) {
  const { orgSlug, draftToken } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const hotel = await getPublicHotelBranchForOrg(org.id);
  if (!hotel) notFound();

  const draft = await getHotelStayDraft({
    organizationId: org.id,
    draftToken,
  });
  if (!draft || draft.branchId !== hotel.id) notFound();

  return (
    <HotelRoomBookingFunnel
      orgSlug={org.slug}
      draftToken={draft.draftToken}
      hotelName={hotel.name}
      expiresAt={draft.expiresAt.toISOString()}
      expired={draft.expired}
      initialPayload={draft.payload}
    />
  );
}
