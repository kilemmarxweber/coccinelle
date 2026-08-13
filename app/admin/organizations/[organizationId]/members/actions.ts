"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { hashPassword } from "better-auth/crypto";
import type { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { assertOrganizationPermission } from "@/lib/auth/organization-permission";
import { consumeAdminCreatedUserPlainPassword, stashAdminCreatedUserPlainPassword } from "@/lib/admin-created-user-password";
import { sendPasswordResetCredentialsEmail } from "@/lib/email/send-password-reset-credentials";
import { generateSecurePassword } from "@/lib/generate-password";
import prisma from "@/lib/prisma";
import {
  createOrgMemberSchema,
  removeOrgMemberSchema,
  resetOrgMemberPasswordSchema,
  updateOrgMemberSchema,
  type CreateOrgMemberInput,
  type RemoveOrgMemberInput,
  type ResetOrgMemberPasswordInput,
  type UpdateOrgMemberInput,
} from "./schema";

function errMessage(err: unknown): string {
  if (typeof err === "object" && err !== null && "message" in err && typeof (err as { message: unknown }).message === "string") {
    return (err as { message: string }).message;
  }
  return "Une erreur est survenue.";
}

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

async function resolveValidBranchIds(
  organizationId: string,
  branchIds: string[],
): Promise<{ ok: true; ids: string[] } | { ok: false; message: string }> {
  const unique = [...new Set(branchIds.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) {
    return { ok: false, message: "Sélectionnez au moins une branche." };
  }
  const branches = await prisma.branch.findMany({
    where: {
      organizationId,
      id: { in: unique },
      status: "ACTIVE",
    },
    select: { id: true },
  });
  if (branches.length !== unique.length) {
    return { ok: false, message: "Une ou plusieurs branches sont invalides ou inactives." };
  }
  return { ok: true, ids: unique };
}

async function syncMemberBranches(
  memberId: string,
  branchIds: string[],
  opsRole: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.branchMember.deleteMany({ where: { memberId } });
    await tx.branchMember.createMany({
      data: branchIds.map((branchId, index) => ({
        branchId,
        memberId,
        role: opsRole,
        isPrimary: index === 0,
        status: "ACTIVE" as const,
      })),
    });
  });
}

export type MemberBranchSummary = {
  id: string;
  name: string;
  code: string;
  type: string;
  isPrimary: boolean;
  opsRole: string;
};

export async function listOrganizationMemberBranchesAction(
  organizationId: string,
): Promise<
  | { ok: true; byMemberId: Record<string, MemberBranchSummary[]> }
  | { ok: false; message: string }
> {
  const gate = await assertOrganizationPermission(organizationId, {
    equipe: ["read"],
  });
  if (!gate.ok) return gate;

  const rows = await prisma.branchMember.findMany({
    where: {
      status: "ACTIVE",
      member: { organizationId },
    },
    select: {
      memberId: true,
      isPrimary: true,
      role: true,
      branch: {
        select: { id: true, name: true, code: true, type: true },
      },
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
  });

  const byMemberId: Record<string, MemberBranchSummary[]> = {};
  for (const row of rows) {
    const list = byMemberId[row.memberId] ?? [];
    list.push({
      id: row.branch.id,
      name: row.branch.name,
      code: row.branch.code,
      type: row.branch.type,
      isPrimary: row.isPrimary,
      opsRole: row.role,
    });
    byMemberId[row.memberId] = list;
  }
  return { ok: true, byMemberId };
}

export async function createOrganizationMemberAction(
  input: CreateOrgMemberInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = createOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, email, name, orgRole, opsRole, branchIds } =
    parsed.data;

  const gate = await assertOrganizationPermission(organizationId, {
    equipe: ["manage"],
  });
  if (!gate.ok) return gate;

  const branches = await resolveValidBranchIds(organizationId, branchIds);
  if (!branches.ok) return branches;

  const h = await headers();
  const emailLower = email.toLowerCase();
  const password = generateSecurePassword(16);
  stashAdminCreatedUserPlainPassword(emailLower, password);

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
      return { ok: false, message: "Création du compte impossible (réponse inattendue)." };
    }
    userId = user.id;

    await auth.api.addMember({
      body: {
        userId: user.id,
        role: orgRole as "owner",
        organizationId,
      },
      headers: h,
    });

    const member = await prisma.member.findFirst({
      where: { userId: user.id, organizationId },
      select: { id: true },
    });
    if (!member) {
      throw new Error("Membre créé mais introuvable pour l’affectation aux branches.");
    }
    await syncMemberBranches(member.id, branches.ids, opsRole);

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

export async function updateOrganizationMemberAction(
  input: UpdateOrgMemberInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = updateOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, memberId, orgRole, opsRole, branchIds } = parsed.data;

  const gate = await assertOrganizationPermission(organizationId, {
    equipe: ["manage"],
  });
  if (!gate.ok) return gate;

  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    select: { id: true },
  });
  if (!member) {
    return { ok: false, message: "Membre introuvable dans cette organisation." };
  }

  const branches = await resolveValidBranchIds(organizationId, branchIds);
  if (!branches.ok) return branches;

  const h = await headers();
  try {
    await auth.api.updateMemberRole({
      body: {
        memberId,
        organizationId,
        role: orgRole as "owner",
      },
      headers: h,
    });
    await syncMemberBranches(memberId, branches.ids, opsRole);
    revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    revalidatePath(`/admin/organizations/${organizationId}/members/${memberId}/edit`, "page");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

export async function removeOrganizationMemberAction(
  input: RemoveOrgMemberInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = removeOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, memberId } = parsed.data;
  const h = await headers();
  try {
    await auth.api.removeMember({
      body: {
        memberIdOrEmail: memberId,
        organizationId,
      },
      headers: h,
    });
    revalidatePath(`/admin/organizations/${organizationId}/members`, "page");
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}

async function setCredentialPassword(userId: string, plainPassword: string): Promise<void> {
  const hashed = await hashPassword(plainPassword);
  const existing = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });
  if (existing) {
    await prisma.account.update({
      where: { id: existing.id },
      data: { password: hashed },
    });
    return;
  }
  await prisma.account.create({
    data: {
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
    },
  });
}

export async function resetOrganizationMemberPasswordAction(
  input: ResetOrgMemberPasswordInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = resetOrgMemberPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, memberId } = parsed.data;

  const gate = await assertOrganizationPermission(organizationId, {
    equipe: ["manage"],
  });
  if (!gate.ok) return gate;

  const member = await prisma.member.findFirst({
    where: { id: memberId, organizationId },
    select: {
      userId: true,
      user: { select: { email: true, name: true } },
    },
  });
  if (!member?.user?.email) {
    return { ok: false, message: "Membre introuvable dans cette organisation." };
  }

  const temporaryPassword = generateSecurePassword(16);
  try {
    await setCredentialPassword(member.userId, temporaryPassword);
    await sendPasswordResetCredentialsEmail({
      to: member.user.email,
      name: member.user.name || member.user.email,
      temporaryPassword,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errMessage(e) };
  }
}
