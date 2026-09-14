import type { Metadata } from "next";
import {
  getAffiliatePortalContextAction,
  listAffiliateCatalogAction,
} from "@/lib/factory/portal-actions";
import { AffilieSignInPrompt } from "../sign-in-prompt";
import { AffilieDemandeForm } from "./demande-form";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Nouvelle demande — Affilié" };
}

export default async function UsineAffilieDemandePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const ctx = await getAffiliatePortalContextAction(orgSlug);
  if (!ctx.ok) {
    return <AffilieSignInPrompt orgSlug={orgSlug} message={ctx.error} />;
  }
  const products = await listAffiliateCatalogAction(orgSlug);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Commander</h1>
        <p className="text-sm text-muted-foreground">
          La demande sera validée par le marketeur avant livraison.
        </p>
      </header>
      {products.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aucun produit fini disponible pour le moment.
        </p>
      ) : (
        <AffilieDemandeForm
          orgSlug={orgSlug}
          products={products}
          defaultAddress={ctx.customer.deliveryAddress ?? ""}
          defaultCity={ctx.customer.deliveryCity ?? ""}
        />
      )}
    </div>
  );
}
