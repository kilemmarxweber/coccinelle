"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAppAdminRole } from "@/lib/permissions";
import { bootstrapBranchByType } from "@/lib/branch/bootstrap-branch";
import {
  deriveAgencyFlags,
  deriveShopFlags,
} from "@/lib/branch/agency-shop";
import { deriveHospitalityBranch } from "@/lib/branch/hospitality";
import prisma from "@/lib/prisma";

const createBranchSchema = z
  .object({
    organizationId: z.string().min(1),
    /** Type choisi dans le formulaire (HOTEL = hospitalité). */
    type: z.enum(["AGENCE", "HOTEL", "BOUTIQUE"]),
    hasStays: z.boolean().optional(),
    hasRestaurant: z.boolean().optional(),
    hasAvion: z.boolean().optional(),
    hasBus: z.boolean().optional(),
    hasBateau: z.boolean().optional(),
    hasPharmacie: z.boolean().optional(),
    hasShop: z.boolean().optional(),
    hasAlimentation: z.boolean().optional(),
    name: z.string().trim().min(2).max(120),
    code: z
      .string()
      .trim()
      .min(2)
      .max(32)
      .regex(
        /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/,
        "Code en MAJUSCULES / chiffres / tirets.",
      ),
    city: z.string().trim().max(80).optional(),
    address: z.string().trim().max(200).optional(),
    phone: z.string().trim().max(40).optional(),
    email: z
      .string()
      .trim()
      .max(120)
      .optional()
      .refine(
        (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        "Email invalide.",
      ),
    imageUrl: z.string().max(700_000).optional().nullable(),
    seedDemo: z.boolean().optional().default(true),
  })
  .superRefine((val, ctx) => {
    if (val.type === "HOTEL") {
      if (val.hasStays !== true && val.hasRestaurant !== true) {
        ctx.addIssue({
          code: "custom",
          message: "Choisissez au moins Séjours ou Restaurant.",
          path: ["hasStays"],
        });
      }
    }
    if (val.type === "AGENCE") {
      if (
        val.hasAvion !== true &&
        val.hasBus !== true &&
        val.hasBateau !== true
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Choisissez au moins Avion, Bus ou Bateau.",
          path: ["hasAvion"],
        });
      }
    }
    if (val.type === "BOUTIQUE") {
      if (
        val.hasPharmacie !== true &&
        val.hasShop !== true &&
        val.hasAlimentation !== true
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Choisissez au moins Pharmacie, Boutique ou Alimentation.",
          path: ["hasPharmacie"],
        });
      }
    }
  });

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export async function createBranchWithBootstrapAction(raw: CreateBranchInput) {
  const parsed = createBranchSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const input = parsed.data;

  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) {
    return { ok: false as const, message: "Non authentifié." };
  }

  const isAdmin = isAppAdminRole(session.user.role);
  const membership = await prisma.member.findFirst({
    where: {
      organizationId: input.organizationId,
      userId: session.user.id,
    },
    select: { id: true, role: true },
  });

  if (!isAdmin && !membership) {
    return {
      ok: false as const,
      message: "Vous n’appartenez pas à cette organisation.",
    };
  }

  if (
    !isAdmin &&
    membership &&
    !["owner", "gestionnaire"].includes(membership.role)
  ) {
    return {
      ok: false as const,
      message: "Permission insuffisante pour créer une branche.",
    };
  }

  const org = await prisma.organization.findUnique({
    where: { id: input.organizationId },
    select: { id: true },
  });
  if (!org) {
    return { ok: false as const, message: "Organisation introuvable." };
  }

  const code = input.code.toUpperCase();
  const exists = await prisma.branch.findUnique({
    where: {
      organizationId_code: { organizationId: input.organizationId, code },
    },
  });
  if (exists) {
    return { ok: false as const, message: "Ce code de branche existe déjà." };
  }

  let branchType = input.type as "AGENCE" | "HOTEL" | "BOUTIQUE" | "RESTAURANT";
  let hasStays = false;
  let hasRestaurant = false;
  let hasAvion = false;
  let hasBus = false;
  let hasBateau = false;
  let hasPharmacie = false;
  let hasShop = false;
  let hasAlimentation = false;

  try {
    if (input.type === "HOTEL") {
      const derived = deriveHospitalityBranch(
        input.hasStays === true,
        input.hasRestaurant === true,
      );
      branchType = derived.type;
      hasStays = derived.hasStays;
      hasRestaurant = derived.hasRestaurant;
    } else if (input.type === "AGENCE") {
      const derived = deriveAgencyFlags({
        hasAvion: input.hasAvion === true,
        hasBus: input.hasBus === true,
        hasBateau: input.hasBateau === true,
      });
      hasAvion = derived.hasAvion;
      hasBus = derived.hasBus;
      hasBateau = derived.hasBateau;
    } else if (input.type === "BOUTIQUE") {
      const derived = deriveShopFlags({
        hasPharmacie: input.hasPharmacie === true,
        hasShop: input.hasShop === true,
        hasAlimentation: input.hasAlimentation === true,
      });
      hasPharmacie = derived.hasPharmacie;
      hasShop = derived.hasShop;
      hasAlimentation = derived.hasAlimentation;
    }

    const created = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          organizationId: input.organizationId,
          type: branchType,
          name: input.name,
          code,
          hasStays,
          hasRestaurant,
          hasAvion,
          hasBus,
          hasBateau,
          hasPharmacie,
          hasShop,
          hasAlimentation,
          city: input.city?.trim() || null,
          address: input.address?.trim() || null,
          phone: input.phone?.trim() || null,
          email: input.email?.trim() || null,
          imageUrl: input.imageUrl?.trim() || null,
          status: "ACTIVE",
        },
      });

      const bootstrap = await bootstrapBranchByType(tx, {
        organizationId: input.organizationId,
        branchId: branch.id,
        type: branchType,
        hasStays,
        hasRestaurant,
        hasAvion,
        hasBus,
        hasBateau,
        hasPharmacie,
        hasShop,
        hasAlimentation,
        seedDemo: input.seedDemo,
        creatorMemberId: membership?.id ?? null,
      });

      return { branch, bootstrap };
    });

    revalidatePath(`/admin/organizations/${input.organizationId}`);
    revalidatePath(`/admin/organizations/${input.organizationId}/branches`);

    return {
      ok: true as const,
      branchId: created.branch.id,
      bootstrap: created.bootstrap,
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Création de branche impossible.";
    return { ok: false as const, message };
  }
}

export async function listBranchesAction(organizationId: string) {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) {
    return { ok: false as const, message: "Non authentifié." };
  }

  const branches = await prisma.branch.findMany({
    where: { organizationId },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: {
      id: true,
      type: true,
      name: true,
      code: true,
      status: true,
      city: true,
      hasStays: true,
      hasRestaurant: true,
      hasAvion: true,
      hasBus: true,
      hasBateau: true,
      hasPharmacie: true,
      hasShop: true,
      hasAlimentation: true,
      createdAt: true,
      _count: {
        select: {
          trajets: true,
          hotelRoomTypes: true,
          shopCategories: true,
          menuItems: true,
          members: true,
        },
      },
    },
  });

  return { ok: true as const, data: branches };
}
