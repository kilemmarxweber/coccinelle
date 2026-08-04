import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckoutStepper, FUNNEL_STEPS } from "@/components/funnel";
import { PwaSearchForm } from "@/components/pwa/pwa-search-form";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) return { title: "Organisation introuvable" };
  return {
    title: `${org.name} — Réserver`,
    description: `Recherchez et réservez vos billets bus ou avion chez ${org.name}.`,
  };
}

export default async function OrgHomePage({ params }: PageProps) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2" aria-labelledby="pwa-home-title">
        <h1
          id="pwa-home-title"
          className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
        >
          {org.name}
        </h1>
        <p className="text-sm text-muted-foreground sm:text-base">
          Recherchez un trajet — bus ou avion — et réservez en quelques étapes.
          Montants en CDF.
        </p>
      </section>

      <CheckoutStepper steps={FUNNEL_STEPS} currentStep="recherche" />

      <section className="flex flex-col gap-3" aria-labelledby="pwa-search-heading">
        <h2 id="pwa-search-heading" className="text-lg font-semibold">
          Où allez-vous ?
        </h2>
        <PwaSearchForm orgSlug={org.slug} />
      </section>
    </div>
  );
}
