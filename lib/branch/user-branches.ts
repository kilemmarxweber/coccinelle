/**
 * Accès branches dans une Organization
 * (BranchMember, owner/gestionnaire, ou admin plateforme).
 */

import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import {
  branchDashboardPath,
  organizationBranchesPath,
} from "@/lib/branch/paths";
import { isAppAdminRole, ORG_ROLE } from "@/lib/permissions";
import prisma from "@/lib/prisma";

export type AccessibleBranch = {
  id: string;
  name: string;
  code: string;
  type: "AGENCE" | "HOTEL" | "BOUTIQUE" | "RESTAURANT";
  hasStays: boolean;
  hasRestaurant: boolean;
  hasAvion: boolean;
  hasBus: boolean;
  hasBateau: boolean;
  hasPharmacie: boolean;
  hasShop: boolean;
  hasAlimentation: boolean;
  organizationId: string;
  organizationName: string;
};

const branchSelect = {
  id: true,
  name: true,
  code: true,
  type: true,
  hasStays: true,
  hasRestaurant: true,
  hasAvion: true,
  hasBus: true,
  hasBateau: true,
  hasPharmacie: true,
  hasShop: true,
  hasAlimentation: true,
  organizationId: true,
  organization: { select: { name: true } },
} as const;

function mapBranch(b: {
  id: string;
  name: string;
  code: string;
  type: AccessibleBranch["type"];
  hasStays: boolean;
  hasRestaurant: boolean;
  hasAvion: boolean;
  hasBus: boolean;
  hasBateau: boolean;
  hasPharmacie: boolean;
  hasShop: boolean;
  hasAlimentation: boolean;
  organizationId: string;
  organization: { name: string };
}): AccessibleBranch {
  return {
    id: b.id,
    name: b.name,
    code: b.code,
    type: b.type,
    hasStays: b.hasStays,
    hasRestaurant: b.hasRestaurant,
    hasAvion: b.hasAvion,
    hasBus: b.hasBus,
    hasBateau: b.hasBateau,
    hasPharmacie: b.hasPharmacie,
    hasShop: b.hasShop,
    hasAlimentation: b.hasAlimentation,
    organizationId: b.organizationId,
    organizationName: b.organization.name,
  };
}

function isOrgBranchChooser(role: string | null | undefined): boolean {
  return (
    role === ORG_ROLE.OWNER ||
    role === ORG_ROLE.GESTIONNAIRE ||
    role === ORG_ROLE.GERANT
  );
}

/** Branches ACTIVE accessibles (optionnellement filtrées par org). */
export async function listAccessibleBranches(
  userId: string,
  appRole: string | null | undefined,
  organizationId?: string,
): Promise<AccessibleBranch[]> {
  if (isAppAdminRole(appRole)) {
    const rows = await prisma.branch.findMany({
      where: {
        status: "ACTIVE",
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: [{ organization: { name: "asc" } }, { name: "asc" }],
      select: branchSelect,
    });
    return rows.map(mapBranch);
  }

  const membership = await getUserOrganizationMembership(userId);
  if (!membership) return [];

  const orgId = organizationId ?? membership.organizationId;
  if (organizationId && organizationId !== membership.organizationId) {
    return [];
  }

  if (isOrgBranchChooser(membership.role)) {
    const rows = await prisma.branch.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      orderBy: [{ name: "asc" }],
      select: branchSelect,
    });
    return rows.map(mapBranch);
  }

  const rows = await prisma.branch.findMany({
    where: {
      organizationId: orgId,
      status: "ACTIVE",
      members: {
        some: {
          status: "ACTIVE",
          member: { userId },
        },
      },
    },
    orderBy: [{ name: "asc" }],
    select: branchSelect,
  });
  return rows.map(mapBranch);
}

/** Accès à une branche (doit appartenir à l’org du membre, sauf admin). */
export async function canAccessBranch(
  userId: string,
  appRole: string | null | undefined,
  branchId: string,
): Promise<AccessibleBranch | null> {
  if (isAppAdminRole(appRole)) {
    const b = await prisma.branch.findFirst({
      where: { id: branchId, status: "ACTIVE" },
      select: branchSelect,
    });
    return b ? mapBranch(b) : null;
  }

  const membership = await getUserOrganizationMembership(userId);
  if (!membership) return null;

  if (isOrgBranchChooser(membership.role)) {
    const b = await prisma.branch.findFirst({
      where: {
        id: branchId,
        organizationId: membership.organizationId,
        status: "ACTIVE",
      },
      select: branchSelect,
    });
    return b ? mapBranch(b) : null;
  }

  const b = await prisma.branch.findFirst({
    where: {
      id: branchId,
      organizationId: membership.organizationId,
      status: "ACTIVE",
      members: {
        some: {
          status: "ACTIVE",
          member: { userId },
        },
      },
    },
    select: branchSelect,
  });
  return b ? mapBranch(b) : null;
}

/**
 * Post-login (hors admin plateforme) :
 * - owner / gestionnaire → liste `/admin/organizations/:orgId/branches`
 * - staff 1 branche → dashboard
 * - staff multi → liste org
 */
export async function resolveDefaultBranchPath(
  userId: string,
  appRole: string | null | undefined,
): Promise<string | null> {
  if (isAppAdminRole(appRole)) return null;

  const membership = await getUserOrganizationMembership(userId);
  if (!membership) return null;

  const { organizationId, role } = membership;

  if (isOrgBranchChooser(role)) {
    return organizationBranchesPath(organizationId);
  }

  const primary = await prisma.branchMember.findFirst({
    where: {
      status: "ACTIVE",
      isPrimary: true,
      member: { userId },
      branch: { status: "ACTIVE", organizationId },
    },
    select: { branchId: true },
    orderBy: { createdAt: "asc" },
  });
  if (primary) {
    return branchDashboardPath(organizationId, primary.branchId);
  }

  const branches = await listAccessibleBranches(userId, appRole, organizationId);
  if (branches.length === 1) {
    return branchDashboardPath(organizationId, branches[0]!.id);
  }
  if (branches.length > 1) {
    return organizationBranchesPath(organizationId);
  }
  return null;
}
