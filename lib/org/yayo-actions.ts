"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { bootstrapBranchByType } from "@/lib/branch/bootstrap-branch";
import { deriveHospitalityBranch } from "@/lib/branch/hospitality";
import { deriveShopFlags } from "@/lib/branch/agency-shop";
import { deriveFactoryFlags } from "@/lib/branch/usine";
import { isAppAdminRole, normalizeOrgRole, ORG_ROLE } from "@/lib/permissions";
import prisma from "@/lib/prisma";
import {
  isCafeYayoOrg,
  parseOrgMetadata,
  withYayoVertical,
  YAYO_DEPARTMENTS,
  type YayoDepartmentTemplate,
} from "@/lib/org/yayo";

async function assertOrgManager(organizationId: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  const isAdmin = isAppAdminRole(session.user.role);
  const membership = await prisma.member.findFirst({
    where: { organizationId, userId: session.user.id },
    select: { id: true, role: true },
  });
  if (!isAdmin && !membership) {
    throw new Error("Vous n’appartenez pas à cette organisation.");
  }
  if (
    !isAdmin &&
    membership &&
    normalizeOrgRole(membership.role) !== ORG_ROLE.OWNER &&
    normalizeOrgRole(membership.role) !== ORG_ROLE.ADMIN
  ) {
    throw new Error("Permission insuffisante.");
  }
  return { user: session.user, membership };
}

export async function getOrgYayoStateAction(organizationId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, slug: true, metadata: true },
  });
  if (!org) return { ok: false as const, message: "Organisation introuvable." };
  return {
    ok: true as const,
    cafeYayo: isCafeYayoOrg(org),
    metadata: parseOrgMetadata(org.metadata),
    name: org.name,
    slug: org.slug,
  };
}

async function createDepartmentFromTemplate(
  organizationId: string,
  tpl: YayoDepartmentTemplate,
  creatorMemberId: string | null,
  seedDemo: boolean,
) {
  const exists = await prisma.branch.findUnique({
    where: {
      organizationId_code: { organizationId, code: tpl.code },
    },
    select: { id: true },
  });
  if (exists) return { created: false, branchId: exists.id };

  let branchType: "BOUTIQUE" | "RESTAURANT" | "HOTEL" | "USINE" = "BOUTIQUE";
  let hasStays = false;
  let hasRestaurant = false;
  let hasPharmacie = false;
  let hasShop = false;
  let hasAlimentation = false;
  let hasEau = false;
  let hasVin = false;
  const hasProduction = Boolean(tpl.hasProduction);

  if (tpl.formType === "HOTEL") {
    const derived = deriveHospitalityBranch(
      tpl.hasStays === true,
      tpl.hasRestaurant !== false,
    );
    branchType = derived.type;
    hasStays = derived.hasStays;
    hasRestaurant = derived.hasRestaurant;
  } else if (tpl.formType === "USINE") {
    branchType = "USINE";
    const flags = deriveFactoryFlags();
    hasEau = flags.hasEau;
    hasVin = flags.hasVin;
  } else {
    const flags = deriveShopFlags({
      hasPharmacie: false,
      hasShop: tpl.hasShop === true,
      hasAlimentation: tpl.hasAlimentation === true,
    });
    hasPharmacie = flags.hasPharmacie;
    hasShop = flags.hasShop;
    hasAlimentation = flags.hasAlimentation;
  }

  const created = await prisma.$transaction(async (tx) => {
    const branch = await tx.branch.create({
      data: {
        organizationId,
        type: branchType,
        name: tpl.name,
        code: tpl.code,
        hasStays,
        hasRestaurant,
        hasPharmacie,
        hasShop,
        hasAlimentation,
        hasEau,
        hasVin,
        hasProduction,
        status: "ACTIVE",
        city: "Kolwezi",
      },
    });
    await bootstrapBranchByType(tx, {
      organizationId,
      branchId: branch.id,
      type: branchType,
      hasStays,
      hasRestaurant,
      hasPharmacie,
      hasShop,
      hasAlimentation,
      hasEau,
      hasVin,
      seedDemo,
      creatorMemberId,
    });
    return branch.id;
  });

  return { created: true, branchId: created };
}

export async function enableCafeYayoAction(input: {
  organizationId: string;
  enabled: boolean;
  seedDepartments?: boolean;
}) {
  const { membership } = await assertOrgManager(input.organizationId);
  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true, metadata: true, name: true, slug: true },
  });
  if (!org) throw new Error("Organisation introuvable.");

  await prisma.organization.update({
    where: { id: org.id },
    data: { metadata: withYayoVertical(org.metadata, input.enabled) },
  });

  const seeded: string[] = [];
  if (input.enabled && input.seedDepartments !== false) {
    for (const tpl of YAYO_DEPARTMENTS) {
      const res = await createDepartmentFromTemplate(
        org.id,
        tpl,
        membership?.id ?? null,
        false,
      );
      if (res.created) seeded.push(tpl.code);
    }
    await prisma.orgCashAccount.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, balanceUsd: 0 },
      update: {},
    });
  }

  revalidatePath(`/admin/organizations/${input.organizationId}`);
  revalidatePath(`/admin/organizations/${input.organizationId}/branches`);
  return { ok: true as const, seeded };
}
