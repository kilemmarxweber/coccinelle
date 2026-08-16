import {
  assertOrganizationPermission,
} from "@/lib/auth/organization-permission";

export type InscriptionPermission =
  | "voir"
  | "ajouter"
  | "modifier"
  | "supprimer"
  | "partager";

/** Vérifie `inscription:*` via Better Auth `hasPermission` (helper générique). */
export async function assertInscriptionPermission(
  organizationId: string,
  permission: InscriptionPermission,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return assertOrganizationPermission(organizationId, {
    inscription: [permission],
  });
}
