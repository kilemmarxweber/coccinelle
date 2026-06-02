import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import {
  isAppAdminRole,
  organizationRoleStatements,
} from "@/lib/permissions";

export type InscriptionPermission = "create" | "update" | "delete" | "share";

function staticRoleAllows(role: string, permission: InscriptionPermission): boolean {
  const perms = organizationRoleStatements[role]?.inscription;
  return perms?.includes(permission) ?? false;
}

async function dynamicRoleAllows(
  organizationId: string,
  role: string,
  permission: InscriptionPermission,
): Promise<boolean> {
  const row = await prisma.organizationRole.findFirst({
    where: { organizationId, role },
    select: { permission: true },
  });
  if (!row?.permission) return false;

  try {
    const parsed = JSON.parse(row.permission) as Record<string, string[]>;
    return parsed.inscription?.includes(permission) ?? false;
  } catch {
    return false;
  }
}

async function memberAllows(
  userId: string,
  organizationId: string,
  permission: InscriptionPermission,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  if (!member) return false;

  if (staticRoleAllows(member.role, permission)) return true;
  return dynamicRoleAllows(organizationId, member.role, permission);
}

/** Vérifie `inscription:*` (Better Auth + repli matrice statique / rôles dynamiques). */
export async function assertInscriptionPermission(
  organizationId: string,
  permission: InscriptionPermission,
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
          permissions: { inscription: [permission] },
        },
      });
      if (result.success) return { ok: true };
    } catch {
      // repli matrice ci-dessous
    }
  }

  const allowed = await memberAllows(session.user.id, organizationId, permission);
  if (!allowed) {
    return { ok: false, message: "Permission insuffisante pour cette action." };
  }

  return { ok: true };
}
