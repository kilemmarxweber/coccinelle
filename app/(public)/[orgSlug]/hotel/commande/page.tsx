import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { HotelOnlineOrderFunnel } from "@/components/hotel/hotel-online-order-funnel";
import { auth } from "@/lib/auth";
import { clientHotelRoutes } from "@/lib/branch/paths";
import {
  findInHouseStayByClaim,
  getPublicHotelBranchForOrg,
  listActiveMenuForBranch,
  readHotelRoomServiceClaim,
} from "@/lib/hotel/client-online-order";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  return {
    title: org ? `Room service — ${org.name}` : "Room service",
  };
}

export default async function ClientHotelCommandePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const hotel = await getPublicHotelBranchForOrg(org.id);
  if (!hotel) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(
      clientHotelRoutes.connexionWithCallback(
        org.slug,
        clientHotelRoutes.commande(org.slug),
      ),
    );
  }

  const [categories, claimCookie] = await Promise.all([
    listActiveMenuForBranch(hotel.id),
    readHotelRoomServiceClaim(),
  ]);

  let initialClaim = null;
  let initialPhone = "";
  let initialRoom = "";

  if (
    claimCookie &&
    claimCookie.organizationId === org.id
  ) {
    initialPhone = claimCookie.guestPhone;
    initialRoom = claimCookie.roomNumber;
    initialClaim = await findInHouseStayByClaim({
      branchId: hotel.id,
      guestPhone: claimCookie.guestPhone,
      roomNumber: claimCookie.roomNumber,
    });
  }

  return (
    <HotelOnlineOrderFunnel
      orgSlug={org.slug}
      organizationId={org.id}
      hotelName={hotel.name}
      categories={categories}
      initialClaim={initialClaim}
      initialPhone={initialPhone}
      initialRoom={initialRoom}
    />
  );
}
