import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { isAppAdminRole } from "@/lib/permissions";

type AgenceLayoutProps = {
  children: ReactNode;
  params: Promise<{ orgId: string }>;
};

/**
 * Layout racine `/agence/[orgId]` — authentifie, vérifie l’appartenance,
 * et fixe l’organisation active Better Auth (session org).
 */
export default async function AgenceOrgLayout({
  children,
  params,
}: AgenceLayoutProps) {
  const { orgId } = await params;
  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const isAdmin = isAppAdminRole(session.user.role);

  if (!isAdmin) {
    const membership = await getUserOrganizationMembership(session.user.id);
    if (!membership || membership.organizationId !== orgId) {
      redirect("/auth/sign-in");
    }
  }

  await auth.api.setActiveOrganization({
    body: { organizationId: orgId },
    headers: requestHeaders,
  });

  return children;
}
