/**
 * Runtime RBAC : charge BranchRole + privileges depuis la DB.
 */

import { randomUUID } from "crypto";
import prisma from "@/lib/prisma";
import {
  expandRolePrivileges,
  SEED_BRANCH_ROLES,
  seedAllows,
  type PrivilegeActionName,
} from "@/lib/branch/privilege-seed";
import {
  normalizeOpsRole,
  OPS_ROLE,
  type OpsRole,
} from "@/lib/branch/ops-roles";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";

type PrivilegeKey = `${string}:${PrivilegeActionName}`;

let seedPromise: Promise<void> | null = null;
const roleCache = new Map<
  string,
  { keys: Set<PrivilegeKey>; views: Set<string>; all: boolean; at: number }
>();
const CACHE_TTL_MS = 30_000;

export function invalidatePrivilegeCache(slug?: string) {
  if (slug) roleCache.delete(slug);
  else roleCache.clear();
}

export async function ensureBranchRolesSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const count = await prisma.branchRole.count();
    if (count >= SEED_BRANCH_ROLES.length) return;

    for (const def of SEED_BRANCH_ROLES) {
      const existing = await prisma.branchRole.findUnique({
        where: { slug: def.slug },
        select: { id: true },
      });
      if (existing) continue;

      const roleId = randomUUID();
      const now = new Date();
      await prisma.branchRole.create({
        data: {
          id: roleId,
          slug: def.slug,
          label: def.label,
          description: def.description,
          isSystem: true,
          sortOrder: def.sortOrder,
          updatedAt: now,
          privileges: {
            create: expandRolePrivileges(def).map((p) => ({
              id: randomUUID(),
              resource: p.resource,
              action: p.action,
              allowed: true,
              updatedAt: now,
            })),
          },
        },
      });
    }
  })().catch((err) => {
    seedPromise = null;
    throw err;
  });
  return seedPromise;
}

async function loadRolePrivileges(slug: string) {
  const cached = roleCache.get(slug);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached;

  await ensureBranchRolesSeeded();

  const role = await prisma.branchRole.findUnique({
    where: { slug },
    include: {
      privileges: { where: { allowed: true } },
    },
  });

  if (!role) {
    const fallback = {
      keys: new Set<PrivilegeKey>(),
      views: new Set<string>(),
      all: slug === OPS_ROLE.PROPRIETAIRE,
      at: Date.now(),
    };
    if (fallback.all) {
      roleCache.set(slug, fallback);
      return fallback;
    }
    // Seed TS fallback
    for (const def of SEED_BRANCH_ROLES) {
      if (def.slug !== slug) continue;
      if (def.all) {
        fallback.all = true;
        break;
      }
      for (const p of expandRolePrivileges(def)) {
        fallback.keys.add(`${p.resource}:${p.action}`);
        if (p.action === "VIEW") fallback.views.add(p.resource);
      }
    }
    roleCache.set(slug, fallback);
    return fallback;
  }

  const keys = new Set<PrivilegeKey>();
  const views = new Set<string>();
  for (const p of role.privileges) {
    keys.add(`${p.resource}:${p.action as PrivilegeActionName}`);
    if (p.action === "VIEW") views.add(p.resource);
  }
  const all = role.slug === OPS_ROLE.PROPRIETAIRE && keys.size > 80;
  const entry = { keys, views, all: role.slug === OPS_ROLE.PROPRIETAIRE || all, at: Date.now() };
  // Propriétaire seed = all resources ; treat slug proprietaire as ALL
  if (role.slug === OPS_ROLE.PROPRIETAIRE) entry.all = true;
  roleCache.set(slug, entry);
  return entry;
}

export async function getViewResourcesForRole(
  opsRole: OpsRole | string,
): Promise<Set<string> | "ALL"> {
  const role = normalizeOpsRole(opsRole);
  if (role === OPS_ROLE.PROPRIETAIRE) return "ALL";
  const loaded = await loadRolePrivileges(role);
  if (loaded.all) return "ALL";
  return loaded.views;
}

export async function canPrivilege(
  opsRole: OpsRole | string,
  resource: string,
  action: PrivilegeActionName,
): Promise<boolean> {
  const role = normalizeOpsRole(opsRole);
  if (role === OPS_ROLE.PROPRIETAIRE) return true;
  const loaded = await loadRolePrivileges(role);
  if (loaded.all) return true;
  if (loaded.keys.has(`${resource}:${action}`)) return true;
  // Si DB partielle, ne pas retomber sur seed (édition Paramètres prime).
  // Si aucun privilege en DB pour ce rôle, fallback seed.
  if (loaded.keys.size === 0) {
    return seedAllows(role, resource, action);
  }
  return false;
}

export async function canSeeDashCardAsync(
  opsRole: OpsRole | string,
  cardId: string | undefined | null,
): Promise<boolean> {
  if (!cardId) return true;
  return canPrivilege(opsRole, cardId, "VIEW");
}

/**
 * Garde pour pages / actions : refuse si pas le privilège.
 * Owner / admin déjà résolus en proprietaire via resolveOpsRole.
 */
export async function assertBranchPrivilege(input: {
  organizationId: string;
  branchId: string;
  resource: string;
  action: PrivilegeActionName;
}): Promise<OpsRole> {
  const opsRole = await resolveCurrentBranchOpsRole(
    input.organizationId,
    input.branchId,
  );
  const ok = await canPrivilege(opsRole, input.resource, input.action);
  if (!ok) {
    throw new Error("Permission insuffisante pour cette action.");
  }
  return opsRole;
}

export async function listAssignableBranchRolesAction() {
  await ensureBranchRolesSeeded();
  const roles = await prisma.branchRole.findMany({
    orderBy: { sortOrder: "asc" },
    select: { slug: true, label: true, isSystem: true },
  });
  return roles;
}

export async function listBranchRolesWithPrivileges() {
  await ensureBranchRolesSeeded();
  return prisma.branchRole.findMany({
    orderBy: { sortOrder: "asc" },
    include: {
      privileges: true,
    },
  });
}

export async function resetRolePrivilegesToSeed(slug: string) {
  const def = SEED_BRANCH_ROLES.find((r) => r.slug === slug);
  if (!def) throw new Error("Rôle inconnu.");
  const role = await prisma.branchRole.findUnique({ where: { slug } });
  if (!role) throw new Error("Rôle introuvable en base.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.branchRolePrivilege.deleteMany({ where: { roleId: role.id } });
    const rows = expandRolePrivileges(def);
    if (rows.length) {
      await tx.branchRolePrivilege.createMany({
        data: rows.map((p) => ({
          id: randomUUID(),
          roleId: role.id,
          resource: p.resource,
          action: p.action,
          allowed: true,
          updatedAt: now,
        })),
      });
    }
    await tx.branchRole.update({
      where: { id: role.id },
      data: { updatedAt: now },
    });
  });
  invalidatePrivilegeCache(slug);
}

export async function saveRolePrivileges(input: {
  slug: string;
  privileges: { resource: string; action: PrivilegeActionName; allowed: boolean }[];
}) {
  const role = await prisma.branchRole.findUnique({
    where: { slug: input.slug },
  });
  if (!role) throw new Error("Rôle introuvable.");

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const p of input.privileges) {
      if (!p.allowed) {
        await tx.branchRolePrivilege.deleteMany({
          where: {
            roleId: role.id,
            resource: p.resource,
            action: p.action,
          },
        });
        continue;
      }
      await tx.branchRolePrivilege.upsert({
        where: {
          roleId_resource_action: {
            roleId: role.id,
            resource: p.resource,
            action: p.action,
          },
        },
        create: {
          id: randomUUID(),
          roleId: role.id,
          resource: p.resource,
          action: p.action,
          allowed: true,
          updatedAt: now,
        },
        update: { allowed: true, updatedAt: now },
      });
    }
    await tx.branchRole.update({
      where: { id: role.id },
      data: { updatedAt: now },
    });
  });
  invalidatePrivilegeCache(input.slug);
}

function slugifyRole(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

export async function createBranchRole(input: {
  label: string;
  description?: string | null;
  slug?: string | null;
  cloneFromSlug?: string | null;
}) {
  const label = input.label.trim();
  if (label.length < 2) throw new Error("Nom du rôle trop court.");
  const slug = slugifyRole(input.slug?.trim() || label);
  if (!slug) throw new Error("Slug invalide.");

  const exists = await prisma.branchRole.findUnique({ where: { slug } });
  if (exists) throw new Error("Ce slug de rôle existe déjà.");

  const maxOrder = await prisma.branchRole.aggregate({
    _max: { sortOrder: true },
  });
  const now = new Date();
  const roleId = randomUUID();

  let privRows: { resource: string; action: PrivilegeActionName }[] = [];
  if (input.cloneFromSlug) {
    const source = await prisma.branchRole.findUnique({
      where: { slug: input.cloneFromSlug },
      include: { privileges: { where: { allowed: true } } },
    });
    if (source) {
      privRows = source.privileges.map((p) => ({
        resource: p.resource,
        action: p.action as PrivilegeActionName,
      }));
    }
  }

  await prisma.branchRole.create({
    data: {
      id: roleId,
      slug,
      label,
      description: input.description?.trim() || null,
      isSystem: false,
      sortOrder: (maxOrder._max.sortOrder ?? 100) + 10,
      updatedAt: now,
      privileges: privRows.length
        ? {
            create: privRows.map((p) => ({
              id: randomUUID(),
              resource: p.resource,
              action: p.action,
              allowed: true,
              updatedAt: now,
            })),
          }
        : undefined,
    },
  });
  invalidatePrivilegeCache(slug);
  return { slug, id: roleId };
}

export async function updateBranchRole(input: {
  slug: string;
  label: string;
  description?: string | null;
}) {
  const role = await prisma.branchRole.findUnique({
    where: { slug: input.slug },
  });
  if (!role) throw new Error("Rôle introuvable.");
  const label = input.label.trim();
  if (label.length < 2) throw new Error("Nom du rôle trop court.");

  await prisma.branchRole.update({
    where: { id: role.id },
    data: {
      label,
      description: input.description?.trim() || null,
      updatedAt: new Date(),
    },
  });
  invalidatePrivilegeCache(input.slug);
}

export async function deleteBranchRole(slug: string) {
  const role = await prisma.branchRole.findUnique({ where: { slug } });
  if (!role) throw new Error("Rôle introuvable.");
  if (role.isSystem) {
    throw new Error("Impossible de supprimer un rôle système.");
  }

  const inUse = await prisma.branchMember.count({
    where: { role: slug, status: "ACTIVE" },
  });
  if (inUse > 0) {
    throw new Error(
      `Ce rôle est encore assigné à ${inUse} membre(s). Réassignez-les d’abord.`,
    );
  }

  await prisma.branchRole.delete({ where: { id: role.id } });
  invalidatePrivilegeCache(slug);
}
