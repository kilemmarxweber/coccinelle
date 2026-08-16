"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { getMembershipInOrganization } from "@/lib/auth/org-membership";
import { isAppAdminRole } from "@/lib/permissions";

/**
 * Restaure l’organisation active après re-login du soft-lock session.
 * La branche reste dans l’URL — pas besoin de l’activer côté session.
 */
export async function restoreSessionLockContextAction(params: {
  organizationId: string | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const { organizationId } = params;
  if (!organizationId) return { ok: true };

  const requestHeaders = await headers();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user?.id) {
    return { ok: false, message: "Session introuvable." };
  }

  if (!isAppAdminRole(session.user.role)) {
    const membership = await getMembershipInOrganization(
      session.user.id,
      organizationId,
    );
    if (!membership) {
      return {
        ok: false,
        message: "Vous n’appartenez plus à cette organisation.",
      };
    }
  }

  try {
    await auth.api.setActiveOrganization({
      body: { organizationId },
      headers: requestHeaders,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossible de restaurer l’organisation active.";
    return { ok: false, message };
  }

  return { ok: true };
}
