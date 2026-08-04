import { ALL_ORG_ROLE_SLUGS, ORG_ROLE } from "@/lib/permissions";

/** Libellés UI FR pour les slugs de rôle d’organisation (U04). */
export const ORG_ROLE_LABEL: Record<(typeof ALL_ORG_ROLE_SLUGS)[number], string> = {
  [ORG_ROLE.OWNER]: "Owner",
  [ORG_ROLE.GESTIONNAIRE]: "Gérant",
  [ORG_ROLE.GUICHETIER]: "Guichetier",
  [ORG_ROLE.PARENT]: "Client",
};

export function orgRoleLabel(slug: string): string {
  return ORG_ROLE_LABEL[slug as keyof typeof ORG_ROLE_LABEL] ?? slug;
}
