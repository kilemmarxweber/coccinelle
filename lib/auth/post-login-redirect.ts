import { legacyGuichetPath } from "@/lib/agence/routes";
import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { organizationBranchesPath } from "@/lib/branch/paths";
import { resolveDefaultBranchPath } from "@/lib/branch/user-branches";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";
import prisma from "@/lib/prisma";

/**
 * Destination après login.
 * Admin plateforme → /admin.
 * Owner / gestionnaire / staff → liste ou dashboard sous
 * `/admin/organizations/[orgId]/branches…`.
 */
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

  const branchPath = await resolveDefaultBranchPath(
    session.user.id,
    session.user.role,
  );
  if (branchPath) {
    return branchPath;
  }

  const { organizationId, role } = membership;

  if (role === ORG_ROLE.GUICHETIER || role === ORG_ROLE.SERVEUR) {
    return legacyGuichetPath(organizationId);
  }

  if (role === ORG_ROLE.CLIENT) {
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    });
    if (org?.slug) {
      return `/${org.slug}/mes-reservations`;
    }
  }

  if (role === ORG_ROLE.OWNER || role === ORG_ROLE.GESTIONNAIRE) {
    return organizationBranchesPath(organizationId);
  }

  return `/admin/organizations/${organizationId}`;
}
