"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { consumeAdminCreatedUserPlainPassword, stashAdminCreatedUserPlainPassword } from "@/lib/admin-created-user-password";
import { generateSecurePassword } from "@/lib/generate-password";
import prisma from "@/lib/prisma";
import {
  createOrgMemberSchema,
  removeOrgMemberSchema,
  updateOrgMemberSchema,
  type CreateOrgMemberInput,
  type RemoveOrgMemberInput,
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

export async function createOrganizationMemberAction(
  input: CreateOrgMemberInput,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = createOrgMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, email, name, orgRole } = parsed.data;
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
  const { organizationId, memberId, orgRole } = parsed.data;
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
