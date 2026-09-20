import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AffilieSectionNav } from "@/components/pwa/affilie-section-nav";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type Props = {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
};

export default async function UsineAffilieLayout({ children, params }: Props) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  const base = `/${org.slug}/usine-affilie`;

  return (
    <div className="flex flex-col gap-4">
      <AffilieSectionNav base={base} />
      {children}
    </div>
  );
}
