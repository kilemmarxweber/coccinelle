import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  assertUserCanJoinOrganization,
  userBelongsToAnotherOrganization,
} from "@/lib/auth/org-membership";
import { ORG_ROLE } from "@/lib/permissions";
import prisma from "@/lib/prisma";

export type EnsureClientResult =
  | { ok: true; clientId: string }
  | { ok: false; error: string };

/**
 * Garantit un profil `Client` + membership org (`client` si nouvellement ajouté)
 * pour un utilisateur authentifié qui paie en ligne.
 * N’utilise pas `inscription:create` (parcours guichet).
 */
export async function ensureClientForOnlineUser(input: {
  userId: string;
  organizationId: string;
  telephone?: string | null;
}): Promise<EnsureClientResult> {
  const h = await headers();

  if (await userBelongsToAnotherOrganization(input.userId, input.organizationId)) {
    return {
      ok: false,
      error:
        "Ce compte est déjà rattaché à une autre agence. Connectez-vous avec un compte client de cette agence.",
    };
  }

  const member = await prisma.member.findFirst({
    where: {
      userId: input.userId,
      organizationId: input.organizationId,
    },
    select: { id: true },
  });

  if (!member) {
    try {
      await assertUserCanJoinOrganization(input.userId, input.organizationId);
      await auth.api.addMember({
        body: {
          userId: input.userId,
          role: ORG_ROLE.CLIENT as "owner",
          organizationId: input.organizationId,
        },
        headers: h,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Impossible de rejoindre l’agence.";
      return { ok: false, error: message };
    }
  }

  const existing = await prisma.client.findUnique({
    where: { userId: input.userId },
    select: { id: true },
  });
  if (existing) {
    return { ok: true, clientId: existing.id };
  }

  const telephone =
    input.telephone?.trim() ||
    `+243${String(Date.now()).slice(-9)}`;

  const client = await prisma.client.create({
    data: {
      userId: input.userId,
      telephone,
    },
    select: { id: true },
  });

  return { ok: true, clientId: client.id };
}
