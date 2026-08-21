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
  return sharedBranchRoutes.equipe(organizationId, branchId);
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
 * Valide le slug : custom DAC de l’org, ou `owner` si autorisé.
 */
async function resolveAssignableOrgRole(
  organizationId: string,
  orgRole: string,
  allowOwner: boolean,
): Promise<
  | { ok: true; role: string; opsRole: string }
  | { ok: false; message: string }
> {
  const role = orgRole.trim().toLowerCase();
  if (!role) return { ok: false, message: "Rôle requis." };

  if (role === ORG_ROLE.OWNER) {
    if (!allowOwner) {
      return {
        ok: false,
        message:
          "Seul un admin plateforme ou le propriétaire de l’organisation peut assigner le rôle owner.",
      };
    }
    return { ok: true, role: ORG_ROLE.OWNER, opsRole: OPS_ROLE.PROPRIETAIRE };
  }

  const row = await prisma.organizationRole.findFirst({
    where: { organizationId, role },
    select: { role: true },
  });
  if (!row) {
    return {
      ok: false,
      message: "Rôle inconnu pour cette organisation. Créez-le d’abord dans Rôles.",
    };
  }
  return { ok: true, role: row.role, opsRole: deriveOpsRole(row.role) };
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

  const canAssignOwner = await canAssignOwnerRole(organizationId);
  const rows = await prisma.organizationRole.findMany({
    where: {
      organizationId,
      NOT: { role: ORG_ROLE.OWNER },
    },
    select: { role: true },
    orderBy: { role: "asc" },
  });

  const roles: AssignableOrgRoleOption[] = rows.map((r: { role: string }) => ({
    role: r.role,
    label: orgRoleLabel(r.role),
    isOwner: false,
  }));

  if (canAssignOwner) {
    roles.unshift({
      role: ORG_ROLE.OWNER,
      label: orgRoleLabel(ORG_ROLE.OWNER),
      isOwner: true,
    });
  }

  return { ok: true, roles, canAssignOwner };
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

  const staff: BranchStaffMember[] = rows.map((row) => ({
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
  }));

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
  const { organizationId, branchId, email, name, phone, orgRole } = parsed.data;

  const gate = await assertOrganizationPermission(organizationId, {
    equipe: ["gerer"],
  });
  if (!gate.ok) return gate;

  const branchOk = await assertBranchInOrg(organizationId, branchId);
  if (!branchOk.ok) return branchOk;

  const allowOwner = await canAssignOwnerRole(organizationId);
  const resolved = await resolveAssignableOrgRole(
    organizationId,
    orgRole,
    allowOwner,
  );
  if (!resolved.ok) return resolved;

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  const h = await headers();
  const emailLower = email.toLowerCase();
  const password = generateSecurePassword(16);
  stashAdminCreatedUserPlainPassword(emailLower, password, {
    phone: phone?.trim() || null,
    branchId,
    organizationName: org?.name ?? null,
    role: resolved.opsRole,
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

    await ensureBranchMember(member.id, branchId, resolved.opsRole);

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
  const { organizationId, branchId, memberId, orgRole } = parsed.data;

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

  const allowOwner = await canAssignOwnerRole(organizationId);
  const resolved = await resolveAssignableOrgRole(
    organizationId,
    orgRole,
    allowOwner,
  );
  if (!resolved.ok) return resolved;

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
      data: { role: resolved.opsRole },
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
