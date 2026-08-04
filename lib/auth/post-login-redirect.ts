import { gerantBasePath, legacyGuichetPath } from "@/lib/agence/routes";
import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import prisma from "@/lib/prisma";

export async function resolvePostLoginPath(requestHeaders: Headers): Promise<string> {
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return "/auth/sign-in";
  }

  if (session.user.role === APP_ROLE.ADMIN) {
    return "/admin";
  }

  const membership = await getUserOrganizationMembership(session.user.id);
  if (!membership) {
    return "/admin";
  }

  await auth.api.setActiveOrganization({
    body: { organizationId: membership.organizationId },
    headers: requestHeaders,
  });

  const { organizationId, role } = membership;

  if (role === ORG_ROLE.GUICHETIER) {
    return legacyGuichetPath(organizationId);
  }

  // Gérant + owner (supervision) → shell gérant
  if (role === ORG_ROLE.GESTIONNAIRE || role === ORG_ROLE.OWNER) {
    return gerantBasePath(organizationId);
  }

  // Client (slug Better Auth `parent`) → espace PWA mes réservations
  if (role === ORG_ROLE.PARENT) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });
    if (org?.slug) {
      return `/${org.slug}/mes-reservations`;
    }
  }

  return `/admin/organizations/${organizationId}`;
}
