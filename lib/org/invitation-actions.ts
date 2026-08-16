"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { assertUserCanJoinOrganization } from "@/lib/auth/org-membership";
import { isAppAdminRole, normalizeOrgRole, ORG_ROLE } from "@/lib/permissions";
import prisma from "@/lib/prisma";

async function assertCanInvite(organizationId: string) {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) throw new Error("Non authentifié.");

  if (isAppAdminRole(session.user.role)) {
    return { session, userId: session.user.id };
  }

  const membership = await prisma.member.findFirst({
    where: { userId: session.user.id, organizationId },
    select: { role: true },
  });
  if (!membership) throw new Error("Organisation inaccessible.");
  const role = normalizeOrgRole(membership.role);
  if (role !== ORG_ROLE.OWNER && role !== ORG_ROLE.ADMIN) {
    throw new Error("Seuls owner et admin peuvent inviter.");
  }
  return { session, userId: session.user.id };
}

export async function listOrganizationInvitationsAction(
  organizationId: string,
) {
  await assertCanInvite(organizationId);
  const rows = await prisma.invitation.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role ?? ORG_ROLE.USER,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function inviteOrganizationMemberAction(input: {
  organizationId: string;
  email: string;
  role?: string;
}) {
  const { userId } = await assertCanInvite(input.organizationId);
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Email invalide.");

  const role = normalizeOrgRole(input.role ?? ORG_ROLE.USER);
  if (role === ORG_ROLE.OWNER) {
    throw new Error("Invitez en admin ou user — pas en owner via invitation.");
  }

  const existingMember = await prisma.member.findFirst({
    where: {
      organizationId: input.organizationId,
      user: { email },
    },
    select: { id: true },
  });
  if (existingMember) {
    throw new Error("Cet utilisateur est déjà membre de l’organisation.");
  }

  const pending = await prisma.invitation.findFirst({
    where: {
      organizationId: input.organizationId,
      email,
      status: "pending",
    },
    select: { id: true },
  });
  if (pending) {
    throw new Error("Une invitation est déjà en attente pour cet email.");
  }

  const h = await headers();
  try {
    await auth.api.createInvitation({
      body: {
        email,
        role,
        organizationId: input.organizationId,
        resend: true,
      },
      headers: h,
    });
  } catch (e) {
    // Fallback manuel si l’API Better Auth exige un email sender non configuré
    const message = e instanceof Error ? e.message : "";
    if (!/email|send/i.test(message)) throw e;

    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await prisma.invitation.create({
      data: {
        id,
        organizationId: input.organizationId,
        email,
        role,
        status: "pending",
        expiresAt,
        inviterId: userId,
      },
    });
  }

  revalidatePath(`/admin/organizations/${input.organizationId}/members`);
  return { ok: true as const };
}

export async function cancelOrganizationInvitationAction(input: {
  organizationId: string;
  invitationId: string;
}) {
  await assertCanInvite(input.organizationId);
  await prisma.invitation.updateMany({
    where: {
      id: input.invitationId,
      organizationId: input.organizationId,
      status: "pending",
    },
    data: { status: "canceled" },
  });
  revalidatePath(`/admin/organizations/${input.organizationId}/members`);
  return { ok: true as const };
}

export async function acceptOrganizationInvitationAction(invitationId: string) {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) throw new Error("Non authentifié.");

  const invitation = await prisma.invitation.findUnique({
    where: { id: invitationId },
  });
  if (!invitation || invitation.status !== "pending") {
    throw new Error("Invitation introuvable ou expirée.");
  }
  if (invitation.expiresAt.getTime() < Date.now()) {
    throw new Error("Invitation expirée.");
  }
  if (invitation.email.toLowerCase() !== session.user.email.toLowerCase()) {
    throw new Error("Cette invitation n’est pas destinée à votre compte.");
  }

  try {
    await auth.api.acceptInvitation({
      body: { invitationId },
      headers: h,
    });
  } catch {
    // Acceptation manuelle si l’API échoue (invitation créée en fallback)
    await assertUserCanJoinOrganization(
      session.user.id,
      invitation.organizationId,
    );

    const role = normalizeOrgRole(invitation.role ?? ORG_ROLE.USER);
    await prisma.member.create({
      data: {
        id: crypto.randomUUID(),
        organizationId: invitation.organizationId,
        userId: session.user.id,
        role,
        createdAt: new Date(),
      },
    });
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { status: "accepted" },
    });
  }

  await auth.api.setActiveOrganization({
    body: { organizationId: invitation.organizationId },
    headers: h,
  });

  revalidatePath("/admin/organizations");
  revalidatePath(`/admin/organizations/${invitation.organizationId}`);

  return {
    ok: true as const,
    organizationId: invitation.organizationId,
  };
}

/** Invitations pending pour l’email de l’utilisateur connecté. */
export async function listMyPendingInvitationsAction() {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user?.email) return [];

  const email = session.user.email.toLowerCase();
  const rows = await prisma.invitation.findMany({
    where: {
      email: { equals: email, mode: "insensitive" },
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      role: true,
      expiresAt: true,
      organization: { select: { id: true, name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    role: r.role ?? ORG_ROLE.USER,
    expiresAt: r.expiresAt.toISOString(),
    organizationId: r.organization.id,
    organizationName: r.organization.name,
  }));
}
