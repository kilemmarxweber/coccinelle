import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type OrgPwaLayoutProps = {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
};

/**
 * Layout org partagé — pas de chrome Voyage ici.
 * Voyage : `(voyage)/layout.tsx` · Hôtel : `hotel/layout.tsx`.
 */
export default async function OrgPwaLayout({
  children,
  params,
}: OrgPwaLayoutProps) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  return (
    <div className="min-h-svh bg-gradient-to-b from-primary/8 via-background to-background">
      {children}
    </div>
  );
}
