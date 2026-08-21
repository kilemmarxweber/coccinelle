import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  organizationProductStatements,
  isAppAdminRole,
  organizationRoleStatements,
} from "@/lib/permissions";

export type OrganizationResource = keyof typeof organizationProductStatements;

export type OrganizationPermissionMap = {
  [K in OrganizationResource]?: ReadonlyArray<
    (typeof organizationProductStatements)[K][number]
  >;
};

/**
 * Vérifie qu’une matrice accordée couvre toutes les actions demandées.
 * Pure — utilisée par le gate serveur et les tests R07 (caisse / hôtel).
 */
export function permissionMapAllows(
  granted: Record<string, readonly string[] | string[] | undefined> | null | undefined,
  required: OrganizationPermissionMap,
): boolean {
  if (!granted) return false;
  for (const [resource, actions] of Object.entries(required) as Array<
    [OrganizationResource, ReadonlyArray<string> | undefined]
  >) {
    if (!actions?.length) continue;
    const allowed = granted[resource];
    if (!allowed) return false;
    if (!actions.every((action) => allowed.includes(action))) return false;
  }
  return true;
}

function staticRoleAllows(
  role: string,
  permissions: OrganizationPermissionMap,
): boolean {
  const statements = organizationRoleStatements[role];
  if (!statements) return false;
  return permissionMapAllows(
    statements as Record<string, readonly string[] | undefined>,
    permissions,
  );
}

async function dynamicRoleAllows(
  organizationId: string,
  role: string,
  permissions: OrganizationPermissionMap,
): Promise<boolean> {
  const row = await prisma.organizationRole.findFirst({
    where: { organizationId, role },
    select: { permission: true },
  });
  if (!row?.permission) return false;

  try {
    const parsed = JSON.parse(row.permission) as Record<string, string[]>;
    return permissionMapAllows(parsed, permissions);
  } catch {
    return false;
  }
}

async function memberAllows(
  userId: string,
  organizationId: string,
  permissions: OrganizationPermissionMap,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  if (!member) return false;

  const roles = member.role.split(",").map((r) => r.trim()).filter(Boolean);
  for (const role of roles) {
    if (staticRoleAllows(role, permissions)) return true;
    if (await dynamicRoleAllows(organizationId, role, permissions)) return true;
  }
  return false;
}

/**
 * Gate serveur Better Auth : `auth.api.hasPermission`,
 * avec repli matrice statique / rôles dynamiques (catalogue FR R01).
 * Platform `admin` : bypass org (comportement actuel).
 */
export async function assertOrganizationPermission(
  organizationId: string,
  permissions: OrganizationPermissionMap,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) {
    return { ok: false, message: "Non authentifié." };
  }

  if (isAppAdminRole(session.user.role)) {
    return { ok: true };
  }

  if ("hasPermission" in auth.api) {
    try {
      const result = await auth.api.hasPermission({
        headers: h,
        body: {
          organizationId,
          permissions: permissions as Record<string, string[]>,
        },
      });
      if (result.success) return { ok: true };
    } catch {
      // repli matrice ci-dessous
    }
  }

  const allowed = await memberAllows(session.user.id, organizationId, permissions);
  if (!allowed) {
    return { ok: false, message: "Permission insuffisante pour cette action." };
  }

  return { ok: true };
}

/** Variante booléenne — UI / filtres hub. */
export async function hasOrganizationPermission(
  organizationId: string,
  permissions: OrganizationPermissionMap,
): Promise<boolean> {
  const result = await assertOrganizationPermission(organizationId, permissions);
  return result.ok;
}

/**
 * Gate actions serveur : refuse avec Error si permission manquante.
 * À combiner avec `canAccessBranch` (appartenance établissement).
 */
export async function requireOrganizationPermission(
  organizationId: string,
  permissions: OrganizationPermissionMap,
): Promise<void> {
  const result = await assertOrganizationPermission(organizationId, permissions);
  if (!result.ok) throw new Error(result.message);
}
