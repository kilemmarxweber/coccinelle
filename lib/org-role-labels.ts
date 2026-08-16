import { ALL_ORG_ROLE_SLUGS, ORG_ROLE } from "@/lib/permissions";
import { ORG_ROLE_PRESET_LABEL_FR } from "@/lib/org/role-presets";

/** Libellés UI FR pour les slugs de rôle d’organisation. */
export const ORG_ROLE_LABEL: Record<(typeof ALL_ORG_ROLE_SLUGS)[number], string> =
  {
    [ORG_ROLE.OWNER]: "Owner",
    [ORG_ROLE.CAISSIER]: ORG_ROLE_PRESET_LABEL_FR.caissier,
    [ORG_ROLE.SERVEUR]: ORG_ROLE_PRESET_LABEL_FR.serveur,
    [ORG_ROLE.RECEPTIONNISTE]: ORG_ROLE_PRESET_LABEL_FR.receptionniste,
    [ORG_ROLE.GERANT]: ORG_ROLE_PRESET_LABEL_FR.gerant,
    [ORG_ROLE.GUICHETIER]: ORG_ROLE_PRESET_LABEL_FR.guichetier,
    [ORG_ROLE.CLIENT]: ORG_ROLE_PRESET_LABEL_FR.client,
  };

const LEGACY_LABEL: Record<string, string> = {
  [ORG_ROLE.GESTIONNAIRE]: "Gérant",
  [ORG_ROLE.PARENT]: "Client",
};

export function orgRoleLabel(slug: string): string {
  if (slug in ORG_ROLE_LABEL) {
    return ORG_ROLE_LABEL[slug as keyof typeof ORG_ROLE_LABEL];
  }
  return LEGACY_LABEL[slug] ?? slug;
}
