import { legacyGuichetPath } from "@/lib/agence/routes";
import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { organizationBranchesPath } from "@/lib/branch/paths";
import { resolveDefaultBranchPath } from "@/lib/branch/user-branches";
import { APP_ROLE, ORG_ROLE, normalizeOrgRole } from "@/lib/permissions";

/**
 * Destination après login.
 * Admin plateforme → /admin.
 * Owner / admin org / user → liste ou dashboard sous
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
  const orgRole = normalizeOrgRole(role);

  if (orgRole === ORG_ROLE.USER) {
    // Staff ops : tenter guichet legacy si pas de branche résolue
    return legacyGuichetPath(organizationId);
  }

  if (orgRole === ORG_ROLE.OWNER || orgRole === ORG_ROLE.ADMIN) {
    return organizationBranchesPath(organizationId);
  }

  return `/admin/organizations/${organizationId}`;
}
