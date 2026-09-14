import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
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
      <nav className="flex flex-wrap gap-2 text-sm">
        <Link
          href={base}
          className="rounded-full bg-muted px-3 py-1.5 font-medium text-foreground"
        >
          Tableau de bord
        </Link>
        <Link
          href={`${base}/demande`}
          className="rounded-full px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Commander
        </Link>
        <Link
          href={`${base}/preferences`}
          className="rounded-full px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Préférences
        </Link>
      </nav>
      {children}
    </div>
  );
}
