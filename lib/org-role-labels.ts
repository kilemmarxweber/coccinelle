import { ALL_ORG_ROLE_SLUGS, ORG_ROLE } from "@/lib/permissions";

/** Libellés UI pour les slugs de rôle d’organisation. */
export const ORG_ROLE_LABEL: Record<(typeof ALL_ORG_ROLE_SLUGS)[number], string> = {
  [ORG_ROLE.OWNER]: "Propriétaire",
  [ORG_ROLE.GESTIONNAIRE]: "Gestionnaire",
  [ORG_ROLE.PARENT]: "Parent",
  [ORG_ROLE.MONITEUR]: "Moniteur",
  [ORG_ROLE.RESPONSABLE]: "Responsable",
  [ORG_ROLE.SURVEILLANT]: "Surveillant",
};

export function orgRoleLabel(slug: string): string {
  return ORG_ROLE_LABEL[slug as keyof typeof ORG_ROLE_LABEL] ?? slug;
}
