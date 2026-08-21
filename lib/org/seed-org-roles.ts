/**
 * Seed / bootstrap OrganizationRole pour les presets R02.
 * Insert Prisma aligné Better Auth (`permission` = JSON stringifié).
 * Idempotent : ne crée que les rôles manquants ; ne touche jamais Member.role = owner.
 */

import { randomUUID } from "node:crypto";
import prisma from "@/lib/prisma";
import {
  BRANCH_OPS_ROLE_TO_PRESET,
  LEGACY_MEMBER_ROLE_TO_PRESET,
  ORG_ROLE_PRESET_PERMISSIONS,
  ORG_ROLE_PRESET_SLUGS,
  serializeOrgRolePermission,
  type OrgRolePresetSlug,
} from "@/lib/org/role-presets";

export type SeedOrgRolesResult = {
  organizationId: string;
  created: OrgRolePresetSlug[];
  skipped: OrgRolePresetSlug[];
};

export type MigrateLegacyRolesResult = {
  memberLegacyUpdated: number;
  memberFromBranchOpsUpdated: number;
  ownerSkipped: number;
};

/** Crée les OrganizationRole presets manquants pour une org. */
export async function seedOrganizationRolePresets(
  organizationId: string,
): Promise<SeedOrgRolesResult> {
  const existing = await prisma.organizationRole.findMany({
    where: {
      organizationId,
      role: { in: [...ORG_ROLE_PRESET_SLUGS] },
    },
    select: { role: true },
  });
  const have = new Set(existing.map((r: { role: string }) => r.role));

  const created: OrgRolePresetSlug[] = [];
  const skipped: OrgRolePresetSlug[] = [];
  const now = new Date();

  for (const slug of ORG_ROLE_PRESET_SLUGS) {
    if (have.has(slug)) {
      skipped.push(slug);
      continue;
    }
    await prisma.organizationRole.create({
      data: {
        id: randomUUID(),
        organizationId,
        role: slug,
        permission: serializeOrgRolePermission(
          ORG_ROLE_PRESET_PERMISSIONS[slug],
        ),
        createdAt: now,
        updatedAt: now,
      },
    });
    created.push(slug);
  }

  return { organizationId, created, skipped };
}

/** Seed presets pour toutes les organisations (script one-shot / seed). */
export async function seedOrganizationRolePresetsForAllOrgs(): Promise<
  SeedOrgRolesResult[]
> {
  const orgs = await prisma.organization.findMany({ select: { id: true } });
  const results: SeedOrgRolesResult[] = [];
  for (const org of orgs) {
    results.push(await seedOrganizationRolePresets(org.id));
  }
  return results;
}

/**
 * Migre les anciens slugs Member + sync ops BranchMember → presets.
 * Ne modifie jamais un membre dont le rôle primaire est `owner`.
 */
export async function migrateLegacyMemberRoleSlugs(): Promise<MigrateLegacyRolesResult> {
  let memberLegacyUpdated = 0;
  let memberFromBranchOpsUpdated = 0;
  let ownerSkipped = 0;

  const members = await prisma.member.findMany({
    select: { id: true, role: true },
  });

  for (const member of members) {
    const roles = member.role
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    if (roles.includes("owner")) {
      ownerSkipped += 1;
      continue;
    }

    let changed = false;
    const next = roles.map((r) => {
      const mapped = LEGACY_MEMBER_ROLE_TO_PRESET[r];
      if (mapped && mapped !== r) {
        changed = true;
        return mapped;
      }
      return r;
    });

    if (changed) {
      await prisma.member.update({
        where: { id: member.id },
        data: { role: [...new Set(next)].join(",") },
      });
      memberLegacyUpdated += 1;
    }
  }

  const branchMembers = await prisma.branchMember.findMany({
    where: { status: "ACTIVE" },
    select: {
      role: true,
      member: { select: { id: true, role: true } },
    },
  });

  for (const bm of branchMembers) {
    const ops = (bm.role ?? "").trim().toLowerCase();
    const preset = BRANCH_OPS_ROLE_TO_PRESET[ops];
    if (!preset) continue;

    const memberRoles = bm.member.role
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    if (memberRoles.includes("owner")) {
      ownerSkipped += 1;
      continue;
    }

    if (memberRoles.includes(preset) && memberRoles.length === 1) {
      continue;
    }

    await prisma.member.update({
      where: { id: bm.member.id },
      data: { role: preset },
    });
    memberFromBranchOpsUpdated += 1;
  }

  return {
    memberLegacyUpdated,
    memberFromBranchOpsUpdated,
    ownerSkipped,
  };
}

/** Seed presets + migration slugs (idempotent, re-run safe). */
export async function bootstrapOrganizationRolesForExistingOrgs(): Promise<{
  seeds: SeedOrgRolesResult[];
  migration: MigrateLegacyRolesResult;
}> {
  const seeds = await seedOrganizationRolePresetsForAllOrgs();
  const migration = await migrateLegacyMemberRoleSlugs();
  return { seeds, migration };
}
