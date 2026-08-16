import prisma from "@/lib/prisma";
import { normalizeOrgRole } from "@/lib/permissions";

export async function countUserOrganizations(userId: string): Promise<number> {
  return prisma.member.count({ where: { userId } });
}

/** True si le user est déjà membre d’une autre org (info, plus de blocage). */
export async function userBelongsToAnotherOrganization(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const other = await prisma.member.findFirst({
    where: {
      userId,
      organizationId: { not: organizationId },
    },
    select: { id: true },
  });
  return other !== null;
}

/**
 * Multi-org autorisé : un user peut rejoindre plusieurs organisations
 * (invitation ou ajout). Seul refus = déjà membre de cette org.
 */
export async function assertUserCanJoinOrganization(
  userId: string,
  organizationId: string,
): Promise<void> {
  const already = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { id: true },
  });
  if (already) {
    throw new Error("Cet utilisateur est déjà membre de cette organisation.");
  }
}

export type OrgMembership = {
  organizationId: string;
  role: string;
  organizationName: string;
  organizationSlug: string;
};

/** Toutes les organisations du user (pour switcher). */
export async function listUserOrganizationMemberships(
  userId: string,
): Promise<OrgMembership[]> {
  const rows = await prisma.member.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      organizationId: true,
      role: true,
      organization: { select: { name: true, slug: true } },
    },
  });
  return rows.map((r) => ({
    organizationId: r.organizationId,
    role: normalizeOrgRole(r.role),
    organizationName: r.organization.name,
    organizationSlug: r.organization.slug,
  }));
}

/** Membership d’une org précise (accès données). */
export async function getMembershipInOrganization(
  userId: string,
  organizationId: string,
) {
  return prisma.member.findFirst({
    where: { userId, organizationId },
    select: {
      id: true,
      organizationId: true,
      role: true,
      organization: { select: { name: true, slug: true } },
    },
  });
}

/**
 * Membership « courant » : org active si valide, sinon première appartenance.
 * Ne remplace pas `getMembershipInOrganization` pour les gardes d’URL.
 */
export async function getUserOrganizationMembership(
  userId: string,
  preferredOrganizationId?: string | null,
) {
  if (preferredOrganizationId) {
    const active = await prisma.member.findFirst({
      where: { userId, organizationId: preferredOrganizationId },
      select: { organizationId: true, role: true },
    });
    if (active) return active;
  }

  return prisma.member.findFirst({
    where: { userId },
    select: { organizationId: true, role: true },
    orderBy: { createdAt: "asc" },
  });
}

export type SessionOrganization = {
  id: string;
  name: string;
  role: string;
};

/** Contexte org exposé dans la session (org active ou première appartenance). */
export async function getSessionOrganizationContext(
  userId: string,
  activeOrganizationId?: string | null,
): Promise<SessionOrganization | null> {
  const member = await prisma.member.findFirst({
    where: activeOrganizationId
      ? { userId, organizationId: activeOrganizationId }
      : { userId },
    select: {
      role: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Si activeOrganizationId invalide / périmé → fallback première org
  if (!member && activeOrganizationId) {
    return getSessionOrganizationContext(userId, null);
  }

  if (!member) return null;

  return {
    id: member.organizationId,
    name: member.organization.name,
    role: normalizeOrgRole(member.role),
  };
}
