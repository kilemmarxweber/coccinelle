import { ALL_ORG_ROLE_SLUGS, ORG_ROLE, normalizeOrgRole } from "@/lib/permissions";

/** Libellés UI FR pour les slugs de rôle d’organisation. */
export const ORG_ROLE_LABEL: Record<(typeof ALL_ORG_ROLE_SLUGS)[number], string> = {
  [ORG_ROLE.OWNER]: "Owner",
  [ORG_ROLE.ADMIN]: "Admin",
  [ORG_ROLE.USER]: "User",
};

export function orgRoleLabel(slug: string): string {
  const normalized = normalizeOrgRole(slug);
  return ORG_ROLE_LABEL[normalized] ?? slug;
}
