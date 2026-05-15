import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { APP_ROLE, ORG_ROLE } from "@/lib/permissions";

const ECODIM_ORG_ROLES = new Set<string>([
  ORG_ROLE.RESPONSABLE,
  ORG_ROLE.MONITEUR,
  ORG_ROLE.SURVEILLANT,
]);

const ORG_HOME_ROLES = new Set<string>([
  ORG_ROLE.OWNER,
  ORG_ROLE.GESTIONNAIRE,
]);

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

  const base = `/admin/organizations/${membership.organizationId}`;
  if (ECODIM_ORG_ROLES.has(membership.role)) {
    return `${base}/ecodim`;
  }
  if (ORG_HOME_ROLES.has(membership.role)) {
    return base;
  }

  return base;
}
