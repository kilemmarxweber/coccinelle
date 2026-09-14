import type { Metadata } from "next";
import { getAffiliatePortalContextAction } from "@/lib/factory/portal-actions";
import { AffilieSignInPrompt } from "../sign-in-prompt";
import { AffiliePreferencesForm } from "./preferences-form";

type PageProps = {
  params: Promise<{ orgSlug: string }>;
};

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Préférences — Affilié" };
}

export default async function UsineAffiliePreferencesPage({ params }: PageProps) {
  const { orgSlug } = await params;
  const ctx = await getAffiliatePortalContextAction(orgSlug);
  if (!ctx.ok) {
    return <AffilieSignInPrompt orgSlug={orgSlug} message={ctx.error} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Préférences</h1>
        <p className="text-sm text-muted-foreground">
          Choisissez les familles et les notifications WhatsApp optionnelles.
        </p>
      </header>
      <AffiliePreferencesForm
        orgSlug={orgSlug}
        initial={ctx.customer.notifyPrefs}
      />
    </div>
  );
}
