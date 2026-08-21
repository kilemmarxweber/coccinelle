"use server";

import { headers } from "next/headers";
import { APIError } from "better-auth/api";
import { auth } from "@/lib/auth";
import { firstLoginPasswordSchema } from "@/app/auth/schema";
import { sessionMustChangePassword } from "@/lib/auth/must-change-password";
import prisma from "@/lib/prisma";

export async function completeFirstLoginPasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = firstLoginPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, message: "Reconnectez-vous pour continuer." };
  }
  if (!sessionMustChangePassword(session)) {
    return { ok: false, message: "Aucun changement de mot de passe n’est requis." };
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: false,
      },
      headers: await headers(),
    });
  } catch (error) {
    if (error instanceof APIError) {
      const code = String(error.body?.code ?? "");
      if (code === "INVALID_PASSWORD") {
        return { ok: false, message: "Ancien mot de passe incorrect." };
      }
      return {
        ok: false,
        message: error.message || "Impossible d’enregistrer le mot de passe.",
      };
    }
    return { ok: false, message: "Impossible d’enregistrer le mot de passe." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { mustChangePassword: false },
  });

  return { ok: true };
}
