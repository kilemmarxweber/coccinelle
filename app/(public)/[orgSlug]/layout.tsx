import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { OrgBrandHeader } from "@/components/pwa/org-brand-header";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type OrgPwaLayoutProps = {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
};

export default async function OrgPwaLayout({
  children,
  params,
}: OrgPwaLayoutProps) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  return (
    <div className="min-h-svh bg-gradient-to-b from-primary/8 via-background to-background">
      <OrgBrandHeader org={org} />
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-6">{children}</div>
    </div>
  );
}
