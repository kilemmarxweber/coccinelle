import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { HotelAuthShell } from "@/components/hotel/hotel-auth-shell";
import { HotelSignInForm } from "@/components/hotel/hotel-sign-in-form";
import { resolveHotelPostLoginPath } from "@/lib/auth/hotel-post-login-redirect";
import { safeHotelCallbackUrl } from "@/lib/auth/safe-hotel-callback-url";
import { auth } from "@/lib/auth";
import { getPublicHotelBranchForOrg } from "@/lib/hotel/client-online-order";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

export const metadata: Metadata = {
  title: "Connexion — Hôtel",
  description: "Connectez-vous à l’espace client hôtel.",
};

type PageProps = {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ callbackUrl?: string }>;
};

export default async function HotelConnexionPage({
  params,
  searchParams,
}: PageProps) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const hotel = await getPublicHotelBranchForOrg(org.id);
  if (!hotel) notFound();

  const query = await searchParams;
  const callbackUrl =
    safeHotelCallbackUrl(query.callbackUrl, org.slug) ?? undefined;

  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (session?.user) {
    redirect(await resolveHotelPostLoginPath(h, org.slug, callbackUrl));
  }

  return (
    <HotelAuthShell
      mode="connexion"
      orgSlug={org.slug}
      hotelName={hotel.name}
      callbackUrl={callbackUrl}
    >
      <HotelSignInForm
        orgSlug={org.slug}
        hotelName={hotel.name}
        callbackUrl={callbackUrl}
      />
    </HotelAuthShell>
  );
}
