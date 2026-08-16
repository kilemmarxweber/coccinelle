import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { assertUserCanJoinOrganization } from "@/lib/auth/org-membership";
import { ORG_ROLE } from "@/lib/permissions";
import prisma from "@/lib/prisma";

export type EnsureClientResult =
  | { ok: true; clientId: string }
  | { ok: false; error: string };

/**
 * Garantit un profil `Client` + membership org (`user` si nouvellement ajouté)
 * pour un utilisateur authentifié qui paie en ligne.
 * Multi-org autorisé : on rattache à l’org de la réservation sans bloquer
 * les autres appartenances.
 */
export async function ensureClientForOnlineUser(input: {
  userId: string;
  organizationId: string;
  telephone?: string | null;
}): Promise<EnsureClientResult> {
  const h = await headers();

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
          role: ORG_ROLE.USER as "owner",
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
    input.telephone?.trim() || `+243${String(Date.now()).slice(-9)}`;

  const client = await prisma.client.create({
    data: {
      userId: input.userId,
      telephone,
    },
    select: { id: true },
  });

  return { ok: true, clientId: client.id };
}
