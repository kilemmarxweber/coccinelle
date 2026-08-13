"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { APP_ROLE } from "@/lib/permissions";
import { resolveOpsRole, type OpsRole } from "@/lib/branch/ops-roles";

/** Résout le métier effectif de l’utilisateur courant sur une branche. */
export async function resolveCurrentBranchOpsRole(
  organizationId: string,
  branchId: string,
): Promise<OpsRole> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return resolveOpsRole({});

  const isPlatformAdmin = session.user.role === APP_ROLE.ADMIN;

  const [membership, branchMember] = await Promise.all([
    prisma.member.findFirst({
      where: {
        organizationId,
        userId: session.user.id,
      },
      select: { id: true, role: true },
    }),
    prisma.branchMember.findFirst({
      where: {
        branchId,
        status: "ACTIVE",
        member: { userId: session.user.id, organizationId },
      },
      select: { role: true },
    }),
  ]);

  return resolveOpsRole({
    isPlatformAdmin,
    orgRole: membership?.role,
    branchRole: branchMember?.role,
  });
}
