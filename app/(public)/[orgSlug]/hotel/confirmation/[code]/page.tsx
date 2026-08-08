import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { HotelRoomBookingConfirmation } from "@/components/hotel/hotel-room-booking-confirmation";
import { auth } from "@/lib/auth";
import { clientHotelRoutes } from "@/lib/branch/paths";
import { getMyHotelStayForOrg } from "@/lib/hotel/client-stays";
import type { HotelStayStatusValue } from "@/lib/hotel/stay-status";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type PageProps = {
  params: Promise<{ orgSlug: string; code: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { code } = await params;
  return { title: `Confirmation ${code}` };
}

export default async function HotelRoomConfirmationPage({ params }: PageProps) {
  const { orgSlug, code } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(
      `/auth/sign-in?callbackUrl=${encodeURIComponent(
        clientHotelRoutes.confirmation(org.slug, code),
      )}`,
    );
  }

  const stay = await getMyHotelStayForOrg({
    organizationId: org.id,
    codeUnique: code,
  });
  if (!stay) notFound();

  const paidAmount = stay.payments
    .filter((p) => p.status === "PAYE")
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <HotelRoomBookingConfirmation
      orgSlug={org.slug}
      stay={{
        codeUnique: stay.codeUnique,
        status: stay.status as HotelStayStatusValue,
        guestPrenom: stay.guestPrenom,
        guestNom: stay.guestNom,
        roomTypeName: stay.roomType.name,
        roomNumber: stay.room?.number ?? null,
        checkInDate: stay.checkInDate,
        checkOutDate: stay.checkOutDate,
        totalAmount: stay.totalAmount,
        paidAmount,
        hotelName: stay.branch.name,
      }}
    />
  );
}
