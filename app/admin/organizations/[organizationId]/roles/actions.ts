/**
 * R03 / R05 — CRUD OrganizationRole (Better Auth DAC).
 *
 * Même API depuis l’org (`/roles`) et depuis la branche (`…/equipe/roles`).
 * Les rôles sont toujours stockés en OrganizationRole (partagés org-wide).
 *
 * Suppression : on refuse si des membres ont encore ce rôle
 * (comportement BA `ROLE_IS_ASSIGNED_TO_MEMBERS`) — pas de reassign forcé.
 *
 * MCP Better Auth consulté : createOrgRole / listOrgRoles / updateOrgRole /
 * deleteOrgRole + gates `ac` create|read|update|delete.
 */

"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import {
  ORG_ROLE_PRESET_PERMISSIONS,
  isOrgRolePresetSlug,
  serializeOrgRolePermission,
  type OrgRolePermissionMap,
} from "@/lib/org/role-presets";
import prisma from "@/lib/prisma";
import {
  ORG_ROLE,
  isAppAdminRole,
  organizationProductStatements,
  ownerOrganizationStatements,
} from "@/lib/permissions";
import {
  createOrgRoleInputSchema,
  deleteOrgRoleInputSchema,
  duplicateOrgRoleInputSchema,
  updateOrgRoleInputSchema,
  type CreateOrgRoleInput,
  type DeleteOrgRoleInput,
  type DuplicateOrgRoleInput,
  type UpdateOrgRoleInput,
} from "./schema";

export type OrgRoleListItem = {
  id: string | null;
  role: string;
  permission: Record<string, string[]>;
  isSystem: boolean;
  memberCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AcCapabilities = {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
};

function errMessage(err: unknown): string {
  if (
    typeof err === "object" &&
    err !== null &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "Une erreur est survenue.";
}

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

function mapBaError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("assigned to members") || lower.includes("role_is_assigned")) {
    return "Impossible de supprimer : des membres ont encore ce rôle. Réassignez-les d’abord.";
  }
  if (lower.includes("pre-defined") || lower.includes("pre_defined")) {
    return "Ce rôle système ne peut pas être modifié ou supprimé.";
  }
  if (lower.includes("already exists") || lower.includes("taken")) {
    return "Ce slug de rôle existe déjà.";
  }
  if (lower.includes("not allowed") || lower.includes("forbidden")) {
    return "Permission insuffisante pour cette action.";
  }
  if (lower.includes("not found")) {
    return "Rôle introuvable.";
  }
  return message;
}

function parsePermissionJson(
  raw: string | Record<string, string[]> | null | undefined,
): Record<string, string[]> {
  if (!raw) return {};
  if (typeof raw === "object") return sanitizePermission(raw);
  try {
    return sanitizePermission(JSON.parse(raw) as Record<string, unknown>);
  } catch {
    return {};
  }
}

/** Ne garde que ressources/actions du catalogue produit. */
function sanitizePermission(
  input: Record<string, unknown>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [resource, actions] of Object.entries(input)) {
    if (!(resource in organizationProductStatements)) continue;
    if (!Array.isArray(actions)) continue;
    const allowed = new Set(
      organizationProductStatements[
        resource as keyof typeof organizationProductStatements
      ] as readonly string[],
    );
    const filtered = actions
      .filter((a): a is string => typeof a === "string")
      .filter((a) => allowed.has(a));
    if (filtered.length > 0) out[resource] = [...new Set(filtered)];
  }
  return out;
}

function ownerPermissionMap(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [resource, actions] of Object.entries(ownerOrganizationStatements)) {
    out[resource] = [...actions];
  }
  return out;
}

function rolesPath(organizationId: string) {
  return `/admin/organizations/${organizationId}/roles`;
}

/** Org `/roles` + branches `…/equipe/roles` (même OrganizationRole). */
function revalidateOrgRolePaths(organizationId: string) {
  revalidatePath(rolesPath(organizationId));
  revalidatePath(
    `/admin/organizations/${organizationId}/branches`,
    "layout",
  );
}

async function countMembersByRole(
  organizationId: string,
): Promise<Map<string, number>> {
  const members = await prisma.member.findMany({
    where: { organizationId },
    select: { role: true },
  });
  const counts = new Map<string, number>();
  for (const m of members) {
    const roles = m.role
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    for (const role of new Set(roles)) {
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
  }
  return counts;
}

async function syncMemberRoleRename(
  organizationId: string,
  fromRole: string,
  toRole: string,
): Promise<void> {
  if (fromRole === toRole) return;
  const members = await prisma.member.findMany({
    where: {
      organizationId,
      role: { contains: fromRole },
    },
    select: { id: true, role: true },
  });
  for (const m of members) {
    const parts = m.role
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    if (!parts.includes(fromRole)) continue;
    const next = [...new Set(parts.map((r) => (r === fromRole ? toRole : r)))].join(
      ",",
    );
    if (next !== m.role) {
      await prisma.member.update({ where: { id: m.id }, data: { role: next } });
    }
  }
}

export async function getAcCapabilitiesAction(
  organizationId: string,
): Promise<AcCapabilities> {
  const [read, create, update, del] = await Promise.all([
    assertOrganizationPermission(organizationId, { ac: ["read"] }),
    assertOrganizationPermission(organizationId, { ac: ["create"] }),
    assertOrganizationPermission(organizationId, { ac: ["update"] }),
    assertOrganizationPermission(organizationId, { ac: ["delete"] }),
  ]);
  return {
    canRead: read.ok,
    canCreate: create.ok,
    canUpdate: update.ok,
    canDelete: del.ok,
  };
}

export async function listOrgRolesAction(
  organizationId: string,
): Promise<
  | { ok: true; roles: OrgRoleListItem[]; capabilities: AcCapabilities }
  | { ok: false; message: string; capabilities: AcCapabilities }
> {
  const capabilities = await getAcCapabilitiesAction(organizationId);
  if (!capabilities.canRead) {
    return {
      ok: false,
      message: "Permission insuffisante (Contrôle d’accès · Voir).",
      capabilities,
    };
  }

  const counts = await countMembersByRole(organizationId);
  const rows = await prisma.organizationRole.findMany({
    where: { organizationId },
    orderBy: { role: "asc" },
  });

  const custom: OrgRoleListItem[] = rows
    .filter((r: { role: string }) => r.role !== ORG_ROLE.OWNER)
    .map(
      (r: {
        id: string;
        role: string;
        permission: string;
        createdAt: Date;
        updatedAt: Date | null;
      }) => ({
        id: r.id,
        role: r.role,
        permission: parsePermissionJson(r.permission),
        isSystem: false,
        memberCount: counts.get(r.role) ?? 0,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt?.toISOString() ?? null,
      }),
    );

  const owner: OrgRoleListItem = {
    id: null,
    role: ORG_ROLE.OWNER,
    permission: ownerPermissionMap(),
    isSystem: true,
    memberCount: counts.get(ORG_ROLE.OWNER) ?? 0,
    createdAt: null,
    updatedAt: null,
  };

  return {
    ok: true,
    roles: [owner, ...custom],
    capabilities,
  };
}

async function createRoleViaBaOrPrisma(args: {
  organizationId: string;
  role: string;
  permission: Record<string, string[]>;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) {
    return { ok: false, message: "Non authentifié." };
  }

  const existing = await prisma.organizationRole.findFirst({
    where: { organizationId: args.organizationId, role: args.role },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: "Ce slug de rôle existe déjà." };
  }
  if (args.role === ORG_ROLE.OWNER) {
    return { ok: false, message: "Le rôle owner est système et ne peut pas être créé." };
  }

  try {
    const result = await auth.api.createOrgRole({
      headers: h,
      body: {
        organizationId: args.organizationId,
        role: args.role,
        permission: args.permission,
      },
    });
    const roleData =
      result && typeof result === "object" && "roleData" in result
        ? (result.roleData as { id?: string } | null)
        : null;
    if (roleData?.id) return { ok: true, id: roleData.id };

    const created = await prisma.organizationRole.findFirst({
      where: { organizationId: args.organizationId, role: args.role },
      select: { id: true },
    });
    if (created) return { ok: true, id: created.id };
  } catch (err) {
    if (!isAppAdminRole(session.user.role)) {
      return { ok: false, message: mapBaError(errMessage(err)) };
    }
  }

  // Repli admin plateforme (hors membership BA) — insert aligné createOrgRole.
  if (!isAppAdminRole(session.user.role)) {
    return { ok: false, message: "Création du rôle impossible." };
  }

  const id = randomUUID();
  const now = new Date();
  await prisma.organizationRole.create({
    data: {
      id,
      organizationId: args.organizationId,
      role: args.role,
      permission: serializeOrgRolePermission(args.permission as OrgRolePermissionMap),
      createdAt: now,
      updatedAt: now,
    },
  });
  return { ok: true, id };
}

export async function createOrgRoleAction(
  input: CreateOrgRoleInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const parsed = createOrgRoleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: zodFirstMessage(parsed.error) };

  const { organizationId, role } = parsed.data;
  if (role === ORG_ROLE.OWNER) {
    return { ok: false, message: "Le rôle owner est système et ne peut pas être créé." };
  }

  const gate = await assertOrganizationPermission(organizationId, {
    ac: ["create"],
  });
  if (!gate.ok) return gate;

  let permission = sanitizePermission(parsed.data.permission);
  if (
    Object.keys(permission).length === 0 &&
    parsed.data.preset &&
    isOrgRolePresetSlug(parsed.data.preset)
  ) {
    permission = sanitizePermission({
      ...ORG_ROLE_PRESET_PERMISSIONS[parsed.data.preset],
    });
  }

  const created = await createRoleViaBaOrPrisma({
    organizationId,
    role,
    permission,
  });
  if (!created.ok) return created;

  revalidateOrgRolePaths(organizationId);
  return created;
}

export async function updateOrgRoleAction(
  input: UpdateOrgRoleInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = updateOrgRoleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: zodFirstMessage(parsed.error) };

  const { organizationId, roleId, roleName, permission } = parsed.data;
  const gate = await assertOrganizationPermission(organizationId, {
    ac: ["update"],
  });
  if (!gate.ok) return gate;

  const existing = await prisma.organizationRole.findFirst({
    where: { id: roleId, organizationId },
  });
  if (!existing) return { ok: false, message: "Rôle introuvable." };
  if (existing.role === ORG_ROLE.OWNER) {
    return { ok: false, message: "Le rôle owner ne peut pas être modifié." };
  }
  if (roleName === ORG_ROLE.OWNER) {
    return { ok: false, message: "Impossible de renommer un rôle en owner." };
  }

  const nextPermission =
    permission !== undefined
      ? sanitizePermission(permission)
      : parsePermissionJson(existing.permission);
  const nextName = roleName?.toLowerCase() ?? existing.role;

  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) return { ok: false, message: "Non authentifié." };

  try {
    await auth.api.updateOrgRole({
      headers: h,
      body: {
        organizationId,
        roleId,
        data: {
          ...(roleName ? { roleName: nextName } : {}),
          ...(permission !== undefined ? { permission: nextPermission } : {}),
        },
      },
    });
  } catch (err) {
    if (!isAppAdminRole(session.user.role)) {
      return { ok: false, message: mapBaError(errMessage(err)) };
    }
    if (nextName !== existing.role) {
      const clash = await prisma.organizationRole.findFirst({
        where: {
          organizationId,
          role: nextName,
          NOT: { id: roleId },
        },
        select: { id: true },
      });
      if (clash) return { ok: false, message: "Ce slug de rôle existe déjà." };
    }
    await prisma.organizationRole.update({
      where: { id: roleId },
      data: {
        role: nextName,
        ...(permission !== undefined
          ? {
              permission: serializeOrgRolePermission(
                nextPermission as OrgRolePermissionMap,
              ),
            }
          : {}),
        updatedAt: new Date(),
      },
    });
  }

  if (nextName !== existing.role) {
    await syncMemberRoleRename(organizationId, existing.role, nextName);
  }

  revalidateOrgRolePaths(organizationId);
  return { ok: true };
}

export async function deleteOrgRoleAction(
  input: DeleteOrgRoleInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = deleteOrgRoleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: zodFirstMessage(parsed.error) };

  const { organizationId, roleId } = parsed.data;
  const gate = await assertOrganizationPermission(organizationId, {
    ac: ["delete"],
  });
  if (!gate.ok) return gate;

  const existing = await prisma.organizationRole.findFirst({
    where: { id: roleId, organizationId },
  });
  if (!existing) return { ok: false, message: "Rôle introuvable." };
  if (existing.role === ORG_ROLE.OWNER) {
    return { ok: false, message: "Le rôle owner ne peut pas être supprimé." };
  }

  const counts = await countMembersByRole(organizationId);
  if ((counts.get(existing.role) ?? 0) > 0) {
    return {
      ok: false,
      message:
        "Impossible de supprimer : des membres ont encore ce rôle. Réassignez-les d’abord.",
    };
  }

  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) return { ok: false, message: "Non authentifié." };

  try {
    await auth.api.deleteOrgRole({
      headers: h,
      body: { organizationId, roleId },
    });
  } catch (err) {
    if (!isAppAdminRole(session.user.role)) {
      return { ok: false, message: mapBaError(errMessage(err)) };
    }
    await prisma.organizationRole.delete({ where: { id: roleId } });
  }

  revalidateOrgRolePaths(organizationId);
  return { ok: true };
}

export async function duplicateOrgRoleAction(
  input: DuplicateOrgRoleInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const parsed = duplicateOrgRoleInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: zodFirstMessage(parsed.error) };

  const { organizationId, sourceRoleId, role } = parsed.data;
  if (role === ORG_ROLE.OWNER) {
    return { ok: false, message: "Impossible de dupliquer vers le rôle owner." };
  }

  const gate = await assertOrganizationPermission(organizationId, {
    ac: ["create"],
  });
  if (!gate.ok) return gate;

  const source = await prisma.organizationRole.findFirst({
    where: { id: sourceRoleId, organizationId },
  });
  if (!source) return { ok: false, message: "Rôle source introuvable." };

  return createOrgRoleAction({
    organizationId,
    role,
    permission: parsePermissionJson(source.permission),
  });
}
