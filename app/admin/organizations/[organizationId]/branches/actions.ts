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
    !["owner", "gestionnaire", "gerant"].includes(membership.role)
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
      address: true,
      phone: true,
      email: true,
      imageUrl: true,
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

async function assertCanManageBranch(
  organizationId: string,
): Promise<
  | { ok: true; userId: string }
  | { ok: false; message: string }
> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  if (!session?.user) {
    return { ok: false, message: "Non authentifié." };
  }

  const isAdmin = isAppAdminRole(session.user.role);
  if (isAdmin) return { ok: true, userId: session.user.id };

  const membership = await prisma.member.findFirst({
    where: { organizationId, userId: session.user.id },
    select: { role: true },
  });
  if (!membership) {
    return { ok: false, message: "Vous n’appartenez pas à cette organisation." };
  }
  const roles = membership.role.split(",").map((r) => r.trim());
  if (!roles.some((r) => r === "owner" || r === "gestionnaire" || r === "gerant")) {
    return { ok: false, message: "Permission insuffisante pour gérer les branches." };
  }
  return { ok: true, userId: session.user.id };
}

const updateBranchSchema = z
  .object({
    organizationId: z.string().min(1),
    branchId: z.string().min(1),
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
    status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]),
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
    hasStays: z.boolean().optional(),
    hasRestaurant: z.boolean().optional(),
    hasAvion: z.boolean().optional(),
    hasBus: z.boolean().optional(),
    hasBateau: z.boolean().optional(),
    hasPharmacie: z.boolean().optional(),
    hasShop: z.boolean().optional(),
    hasAlimentation: z.boolean().optional(),
  });

export type UpdateBranchInput = z.infer<typeof updateBranchSchema>;

export async function getBranchAction(organizationId: string, branchId: string) {
  const gate = await assertCanManageBranch(organizationId);
  if (!gate.ok) return gate;

  const branch = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: {
      id: true,
      type: true,
      name: true,
      code: true,
      status: true,
      city: true,
      address: true,
      phone: true,
      email: true,
      imageUrl: true,
      hasStays: true,
      hasRestaurant: true,
      hasAvion: true,
      hasBus: true,
      hasBateau: true,
      hasPharmacie: true,
      hasShop: true,
      hasAlimentation: true,
    },
  });
  if (!branch) {
    return { ok: false as const, message: "Branche introuvable." };
  }
  return { ok: true as const, data: branch };
}

export async function updateBranchAction(raw: UpdateBranchInput) {
  const parsed = updateBranchSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const input = parsed.data;
  const gate = await assertCanManageBranch(input.organizationId);
  if (!gate.ok) return gate;

  const existing = await prisma.branch.findFirst({
    where: { id: input.branchId, organizationId: input.organizationId },
  });
  if (!existing) {
    return { ok: false as const, message: "Branche introuvable." };
  }

  const code = input.code.toUpperCase();
  if (code !== existing.code) {
    const clash = await prisma.branch.findUnique({
      where: {
        organizationId_code: {
          organizationId: input.organizationId,
          code,
        },
      },
      select: { id: true },
    });
    if (clash && clash.id !== existing.id) {
      return { ok: false as const, message: "Ce code de branche existe déjà." };
    }
  }

  let type = existing.type;
  let hasStays = existing.hasStays;
  let hasRestaurant = existing.hasRestaurant;
  let hasAvion = existing.hasAvion;
  let hasBus = existing.hasBus;
  let hasBateau = existing.hasBateau;
  let hasPharmacie = existing.hasPharmacie;
  let hasShop = existing.hasShop;
  let hasAlimentation = existing.hasAlimentation;

  try {
    if (existing.type === "HOTEL" || existing.type === "RESTAURANT") {
      const stays = input.hasStays === true;
      const resto = input.hasRestaurant === true;
      if (!stays && !resto) {
        return {
          ok: false as const,
          message: "Choisissez au moins Séjours ou Restaurant.",
        };
      }
      const derived = deriveHospitalityBranch(stays, resto);
      type = derived.type;
      hasStays = derived.hasStays;
      hasRestaurant = derived.hasRestaurant;
    } else if (existing.type === "AGENCE") {
      const derived = deriveAgencyFlags({
        hasAvion: input.hasAvion === true,
        hasBus: input.hasBus === true,
        hasBateau: input.hasBateau === true,
      });
      if (!derived.hasAvion && !derived.hasBus && !derived.hasBateau) {
        return {
          ok: false as const,
          message: "Choisissez au moins Avion, Bus ou Bateau.",
        };
      }
      hasAvion = derived.hasAvion;
      hasBus = derived.hasBus;
      hasBateau = derived.hasBateau;
    } else if (existing.type === "BOUTIQUE") {
      const derived = deriveShopFlags({
        hasPharmacie: input.hasPharmacie === true,
        hasShop: input.hasShop === true,
        hasAlimentation: input.hasAlimentation === true,
      });
      if (!derived.hasPharmacie && !derived.hasShop && !derived.hasAlimentation) {
        return {
          ok: false as const,
          message: "Choisissez au moins Pharmacie, Boutique ou Alimentation.",
        };
      }
      hasPharmacie = derived.hasPharmacie;
      hasShop = derived.hasShop;
      hasAlimentation = derived.hasAlimentation;
    }

    await prisma.branch.update({
      where: { id: existing.id },
      data: {
        type,
        name: input.name,
        code,
        status: input.status,
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
        imageUrl:
          input.imageUrl === undefined
            ? undefined
            : input.imageUrl?.trim() || null,
      },
    });

    revalidatePath(`/admin/organizations/${input.organizationId}`);
    revalidatePath(`/admin/organizations/${input.organizationId}/branches`);
    revalidatePath(
      `/admin/organizations/${input.organizationId}/branches/${input.branchId}`,
    );
    revalidatePath(
      `/admin/organizations/${input.organizationId}/branches/edit/${input.branchId}`,
    );

    return { ok: true as const };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Mise à jour de la branche impossible.";
    return { ok: false as const, message };
  }
}

const deleteBranchSchema = z.object({
  organizationId: z.string().min(1),
  branchId: z.string().min(1),
});

export async function deleteBranchAction(raw: z.infer<typeof deleteBranchSchema>) {
  const parsed = deleteBranchSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false as const,
      message: parsed.error.issues[0]?.message ?? "Données invalides.",
    };
  }
  const { organizationId, branchId } = parsed.data;
  const gate = await assertCanManageBranch(organizationId);
  if (!gate.ok) return gate;

  const existing = await prisma.branch.findFirst({
    where: { id: branchId, organizationId },
    select: { id: true, name: true },
  });
  if (!existing) {
    return { ok: false as const, message: "Branche introuvable." };
  }

  try {
    await prisma.branch.delete({ where: { id: branchId } });
    revalidatePath(`/admin/organizations/${organizationId}`);
    revalidatePath(`/admin/organizations/${organizationId}/branches`);
    return { ok: true as const };
  } catch (e) {
    const code =
      typeof e === "object" && e && "code" in e
        ? String((e as { code: unknown }).code)
        : "";
    const message = e instanceof Error ? e.message : "";
    if (
      code === "P2003" ||
      code === "P2014" ||
      message.includes("Foreign key") ||
      message.includes("Restrict") ||
      message.includes("constraint")
    ) {
      return {
        ok: false as const,
        message:
          "Impossible de supprimer : des données métier (séjours, ventes…) bloquent encore cette branche. Archivez-la (statut Fermée) ou libérez ces données d’abord.",
      };
    }
    return {
      ok: false as const,
      message: message || "Suppression de la branche impossible.",
    };
  }
}
