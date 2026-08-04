import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  accessControlStatements,
  isAppAdminRole,
  organizationRoleStatements,
} from "@/lib/permissions";

export type OrganizationResource = keyof typeof accessControlStatements;

export type OrganizationPermissionMap = {
  [K in OrganizationResource]?: ReadonlyArray<(typeof accessControlStatements)[K][number]>;
};

function staticRoleAllows(
  role: string,
  permissions: OrganizationPermissionMap,
): boolean {
  const statements = organizationRoleStatements[role];
  if (!statements) return false;

  for (const [resource, actions] of Object.entries(permissions) as Array<
    [OrganizationResource, ReadonlyArray<string> | undefined]
  >) {
    if (!actions?.length) continue;
    const allowed = statements[resource] as ReadonlyArray<string> | undefined;
    if (!allowed) return false;
    if (!actions.every((action) => allowed.includes(action))) return false;
  }
  return true;
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
    for (const [resource, actions] of Object.entries(permissions) as Array<
      [string, ReadonlyArray<string> | undefined]
    >) {
      if (!actions?.length) continue;
      const allowed = parsed[resource];
      if (!allowed) return false;
      if (!actions.every((action) => allowed.includes(action))) return false;
    }
    return true;
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
 * avec repli matrice statique / rôles dynamiques.
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
