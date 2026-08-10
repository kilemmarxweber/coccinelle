import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { OrgBrandHeader } from "@/components/pwa/org-brand-header";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";

type Props = {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
};

/** Chrome Client Voyage (Plane / Mes billets) — hors routes `/hotel/*`. */
export default async function OrgVoyageLayout({ children, params }: Props) {
  const { orgSlug } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  return (
    <>
      <OrgBrandHeader org={org} />
      <div className="mx-auto w-full max-w-lg px-4 pb-10 pt-6">{children}</div>
    </>
  );
}
