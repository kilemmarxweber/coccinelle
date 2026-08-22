/**
 * R04 — Équipe par établissement.
 *
 * Scope : Member + BranchMember sur la branche courante uniquement.
 * Permissions : Équipe · Voir (liste) / Équipe · Gérer (mutations).
 *
 * Assignation `owner` : réservée à l’admin plateforme ou au owner org
 * (documenté ici + refus serveur / UI).
 */

"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import {
  consumeAdminCreatedUserPlainPassword,
  stashAdminCreatedUserPlainPassword,
} from "@/lib/admin-created-user-password";
import {
  isAssignableOpsRole,
  OPS_ROLE,
} from "@/lib/branch/ops-roles";
import { sharedBranchRoutes } from "@/lib/branch/paths";
import { generateSecurePassword } from "@/lib/generate-password";
import { resolveMemberEmail } from "@/lib/member-email";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { isAppAdminRole, ORG_ROLE } from "@/lib/permissions";
import { ORG_ROLE_PRESET } from "@/lib/org/role-presets";
import prisma from "@/lib/prisma";
import {
  createBranchStaffSchema,
  removeBranchStaffSchema,
  updateBranchStaffRoleSchema,
  type CreateBranchStaffInput,
  type RemoveBranchStaffInput,
  type UpdateBranchStaffRoleInput,
} from "./schema";
import {
  ensureStaffPayrollProfile,
  isCommerceBranchType,
} from "@/lib/payroll/bootstrap";

export type BranchStaffMember = {
  branchMemberId: string;
  memberId: string;
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  orgRole: string;
  opsRole: string;
  isPrimary: boolean;
  createdAt: string;
};

export type AssignableOrgRoleOption = {
  role: string;
  label: string;
  isOwner: boolean;
};

export type EquipeCapabilities = {
  canView: boolean;
  canManage: boolean;
  canAssignOwner: boolean;
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

function equipePath(organizationId: string, branchId: string) {
  return sharedBranchRoutes.parametresUsers(organizationId, branchId);
}

/** BranchMember.role dérivé du rôle org (presets ops alignés). */
function deriveOpsRole(orgRole: string): string {
  const slug = orgRole.trim().toLowerCase();
  if (slug === ORG_ROLE.OWNER) return OPS_ROLE.PROPRIETAIRE;
  if (isAssignableOpsRole(slug)) return slug;
  if (slug === ORG_ROLE_PRESET.GUICHETIER) return OPS_ROLE.CAISSIER;
  return OPS_ROLE.GERANT;
}

async function getSessionUser() {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  return session?.user ?? null;
}

/**
 * Owner assignable uniquement par admin plateforme ou owner de l’org.
 */
async function canAssignOwnerRole(organizationId: string): Promise<boolean> {
  const user = await getSessionUser();
  if (!user) return false;
  if (isAppAdminRole(user.role)) return true;

  const member = await prisma.member.findFirst({
    where: { userId: user.id, organizationId },
    select: { role: true },
  });
  if (!member) return false;
  return member.role
    .split(",")
    .map((r) => r.trim())
    .includes(ORG_ROLE.OWNER);
}

async function assertBranchInOrg(
  organizationId: string,
  branchId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!branch) {
    return { ok: false, message: "Branche introuvable ou inactive." };
  }
  return { ok: true };
}

/**
 * Depuis une branche : Admin ou User uniquement. Owner interdit.
 */
function resolveBranchOrgRole(
  orgRole: string,
): { ok: true; role: string; opsRole: string } | { ok: false; message: string } {
  const role = orgRole.trim().toLowerCase();
  if (role === ORG_ROLE.OWNER) {
    return {
      ok: false,
      message: "Le rôle owner n’est pas assignable depuis une branche.",
    };
  }
  if (role === ORG_ROLE.ADMIN || role === ORG_ROLE.USER) {
    return { ok: true, role, opsRole: deriveOpsRole(role) };
  }
  return { ok: false, message: "Choisissez Admin ou User." };
}

async function resolveOpsRoleSlug(
  slug: string,
  fallback: string,
): Promise<{ ok: true; opsRole: string } | { ok: false; message: string }> {
  const candidate = (slug.trim() || fallback).toLowerCase();
  const row = await prisma.branchRole.findUnique({
    where: { slug: candidate },
    select: { slug: true },
  });
  if (row) return { ok: true, opsRole: row.slug };
  if (isAssignableOpsRole(candidate)) return { ok: true, opsRole: candidate };
  return { ok: false, message: "Métier branche invalide." };
}

export async function getEquipeCapabilitiesAction(
  organizationId: string,
): Promise<EquipeCapabilities> {
  const [view, manage, canAssignOwner] = await Promise.all([
    assertOrganizationPermission(organizationId, { equipe: ["voir"] }),
    assertOrganizationPermission(organizationId, { equipe: ["gerer"] }),
    canAssignOwnerRole(organizationId),
  ]);
  return {
    canView: view.ok,
    canManage: manage.ok,
    canAssignOwner,
  };
}

export async function listAssignableOrgRolesAction(
  organizationId: string,
): Promise<
  | { ok: true; roles: AssignableOrgRoleOption[]; canAssignOwner: boolean }
  | { ok: false; message: string }
> {
  const gate = await assertOrganizationPermission(organizationId, {
    equipe: ["voir"],
  });
  if (!gate.ok) return gate;

  return {
    ok: true,
    roles: [
      {
        role: ORG_ROLE.ADMIN,
        label: orgRoleLabel(ORG_ROLE.ADMIN),
        isOwner: false,
      },
      {
        role: ORG_ROLE.USER,
        label: orgRoleLabel(ORG_ROLE.USER),
        isOwner: false,
      },
    ],
    canAssignOwner: false,
  };
}

export async function listBranchStaffAction(
  organizationId: string,
  branchId: string,
): Promise<
  | {
      ok: true;
      staff: BranchStaffMember[];
      capabilities: EquipeCapabilities;
    }
  | { ok: false; message: string; capabilities: EquipeCapabilities }
> {
  const capabilities = await getEquipeCapabilitiesAction(organizationId);
  if (!capabilities.canView) {
    return {
      ok: false,
      message: "Permission insuffisante (Équipe · Voir).",
      capabilities,
    };
  }

  const branchOk = await assertBranchInOrg(organizationId, branchId);
  if (!branchOk.ok) {
    return { ok: false, message: branchOk.message, capabilities };
  }

  const rows = await prisma.branchMember.findMany({
    where: {
      branchId,
      status: "ACTIVE",
      member: { organizationId },
    },
    select: {
      id: true,
      role: true,
      isPrimary: true,
      createdAt: true,
      member: {
        select: {
          id: true,
          role: true,
          userId: true,
          user: {
            select: { name: true, email: true, phone: true },
          },
        },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  const staff: BranchStaffMember[] = rows
    .map((row) => ({
      branchMemberId: row.id,
      memberId: row.member.id,
      userId: row.member.userId,
      name: row.member.user.name,
      email: row.member.user.email,
      phone: row.member.user.phone,
      orgRole: row.member.role.split(",")[0]?.trim() || row.member.role,
      opsRole: row.role,
      isPrimary: row.isPrimary,
      createdAt: row.createdAt.toISOString(),
    }))
    .filter((member) => member.orgRole !== ORG_ROLE.OWNER);

  staff.sort((a, b) =>
    (a.name || a.email).localeCompare(b.name || b.email, "fr"),
  );

  return { ok: true, staff, capabilities };
}

async function ensureBranchMember(
  memberId: string,
  branchId: string,
  opsRole: string,
): Promise<void> {
  const existing = await prisma.branchMember.findUnique({
    where: {
      branchId_memberId: { branchId, memberId },
    },
    select: { id: true },
  });

  if (existing) {
    await prisma.branchMember.update({
      where: { id: existing.id },
      data: { role: opsRole, status: "ACTIVE" },
    });
    return;
  }

  const otherCount = await prisma.branchMember.count({
    where: { memberId, status: "ACTIVE" },
  });

  await prisma.branchMember.create({
    data: {
      branchId,
      memberId,
      role: opsRole,
      isPrimary: otherCount === 0,
      status: "ACTIVE",
    },
  });
}

export async function createBranchStaffAction(
  input: CreateBranchStaffInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = createBranchStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, email, name, phone, orgRole, opsRole } =
    parsed.data;

  const gate = await assertOrganizationPermission(organizationId, {
    equipe: ["gerer"],
  });
  if (!gate.ok) return gate;

  const branchOk = await assertBranchInOrg(organizationId, branchId);
  if (!branchOk.ok) return branchOk;

  const resolved = resolveBranchOrgRole(orgRole);
  if (!resolved.ok) return resolved;

  const opsResolved = await resolveOpsRoleSlug(opsRole, resolved.opsRole);
  if (!opsResolved.ok) return opsResolved;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true, slug: true },
  });

  const resolvedEmail = await resolveMemberEmail({
    email,
    name,
    organizationSlug: org?.slug ?? "org",
  });
  if (!resolvedEmail.ok) return resolvedEmail;

  const h = await headers();
  const emailLower = resolvedEmail.email;
  const password = generateSecurePassword(16);
  stashAdminCreatedUserPlainPassword(emailLower, password, {
    phone: phone?.trim() || null,
    branchId,
    organizationName: org?.name ?? null,
    role: opsResolved.opsRole,
  });

  let userId: string | null = null;
  try {
    const created = await auth.api.createUser({
      body: {
        email: emailLower,
        name,
        password,
        role: "user",
      },
      headers: h,
    });
    const user = (created as { user?: { id: string } } | null)?.user;
    if (!user?.id) {
      return {
        ok: false,
        message: "Création du compte impossible (réponse inattendue).",
      };
    }
    userId = user.id;

    await auth.api.addMember({
      body: {
        userId: user.id,
        role: resolved.role as "owner",
        organizationId,
      },
      headers: h,
    });

    const member = await prisma.member.findFirst({
      where: { userId: user.id, organizationId },
      select: { id: true },
    });
    if (!member) {
      throw new Error("Membre créé mais introuvable pour le rattachement branche.");
    }

    await ensureBranchMember(member.id, branchId, opsResolved.opsRole);

    const phoneValue = phone?.trim() || null;
    if (phoneValue) {
      await prisma.user.update({
        where: { id: user.id },
        data: { phone: phoneValue },
      });
    }

    const commerceBranch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { type: true },
    });
    if (commerceBranch && isCommerceBranchType(commerceBranch.type)) {
      const bm = await prisma.branchMember.findUnique({
        where: { branchId_memberId: { branchId, memberId: member.id } },
        select: { id: true },
      });
      if (bm) {
        await ensureStaffPayrollProfile(prisma, {
          branchId,
          branchMemberId: bm.id,
          phone: phoneValue,
        });
      }
    }

    revalidatePath(equipePath(organizationId, branchId));
    revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    return { ok: true };
  } catch (e) {
    consumeAdminCreatedUserPlainPassword(emailLower);
    if (userId) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    return { ok: false, message: errMessage(e) };
  }
}

export async function updateBranchStaffRoleAction(
  input: UpdateBranchStaffRoleInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = updateBranchStaffRoleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, memberId, orgRole, opsRole } = parsed.data;

  const gate = await assertOrganizationPermission(organizationId, {
    equipe: ["gerer"],
  });
  if (!gate.ok) return gate;

  const branchOk = await assertBranchInOrg(organizationId, branchId);
  if (!branchOk.ok) return branchOk;

  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId,
      memberId,
      status: "ACTIVE",
      member: { organizationId },
    },
    select: { id: true, memberId: true },
  });
  if (!branchMember) {
    return {
      ok: false,
      message: "Ce membre n’est pas rattaché à cette branche.",
    };
  }

  const resolved = resolveBranchOrgRole(orgRole);
  if (!resolved.ok) return resolved;

  const opsResolved = await resolveOpsRoleSlug(opsRole, resolved.opsRole);
  if (!opsResolved.ok) return opsResolved;

  const h = await headers();
  try {
    await auth.api.updateMemberRole({
      body: {
        memberId,
        organizationId,
        role: resolved.role as "owner",
      },
      headers: h,
    });

    await prisma.branchMember.update({
      where: { id: branchMember.id },
      data: { role: opsResolved.opsRole },
    });

    revalidatePath(equipePath(organizationId, branchId));
    revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    revalidatePath(
      `/admin/organizations/${organizationId}/members/${memberId}/edit`,
      "page",
    );
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function removeBranchStaffAction(
  input: RemoveBranchStaffInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = removeBranchStaffSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, memberId } = parsed.data;

  const gate = await assertOrganizationPermission(organizationId, {
    equipe: ["gerer"],
  });
  if (!gate.ok) return gate;

  const branchOk = await assertBranchInOrg(organizationId, branchId);
  if (!branchOk.ok) return branchOk;

  const branchMember = await prisma.branchMember.findFirst({
    where: {
      branchId,
      memberId,
      member: { organizationId },
    },
    select: { id: true, isPrimary: true },
  });
  if (!branchMember) {
    return {
      ok: false,
      message: "Ce membre n’est pas rattaché à cette branche.",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.branchMember.delete({ where: { id: branchMember.id } });

    if (branchMember.isPrimary) {
      const next = await tx.branchMember.findFirst({
        where: { memberId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      if (next) {
        await tx.branchMember.update({
          where: { id: next.id },
          data: { isPrimary: true },
        });
      }
    }
  });

  revalidatePath(equipePath(organizationId, branchId));
  revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
  return { ok: true };
}
