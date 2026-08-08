import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { HotelOnlineOrderConfirmation } from "@/components/hotel/hotel-online-order-confirmation";
import { auth } from "@/lib/auth";
import { clientHotelRoutes } from "@/lib/branch/paths";
import {
  getGuestFoodOrderForOrg,
  readHotelRoomServiceClaim,
} from "@/lib/hotel/client-online-order";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type PageProps = {
  params: Promise<{ orgSlug: string; orderId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  return {
    title: org ? `Confirmation — ${org.name}` : "Confirmation commande",
  };
}

export default async function ClientHotelOrderConfirmationPage({
  params,
}: PageProps) {
  const { orgSlug, orderId } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect(
      `/auth/sign-in?callbackUrl=${encodeURIComponent(
        clientHotelRoutes.commandeOrder(org.slug, orderId),
      )}`,
    );
  }

  const claim = await readHotelRoomServiceClaim();
  if (!claim || claim.organizationId !== org.id) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Commande</h1>
        <p className="text-sm text-muted-foreground">
          Reliez votre séjour pour consulter le statut de cette commande.
        </p>
        <Button
          render={<Link href={clientHotelRoutes.commande(org.slug)} />}
          className="w-fit"
        >
          Room service
        </Button>
      </div>
    );
  }

  const order = await getGuestFoodOrderForOrg({
    organizationId: org.id,
    orderId,
    guestPhone: claim.guestPhone,
  });
  if (!order) notFound();

  return (
    <HotelOnlineOrderConfirmation orgSlug={org.slug} order={order} />
  );
}
