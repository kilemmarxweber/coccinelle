"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { isAppAdminRole } from "@/lib/permissions";
import { bootstrapBranchByType } from "@/lib/branch/bootstrap-branch";
import prisma from "@/lib/prisma";

const createBranchSchema = z.object({
  organizationId: z.string().min(1),
  type: z.enum(["AGENCE", "HOTEL", "BOUTIQUE"]),
  name: z.string().trim().min(2).max(120),
  code: z
    .string()
    .trim()
    .min(2)
    .max(32)
    .regex(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/, "Code en MAJUSCULES / chiffres / tirets."),
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
});

export type CreateBranchInput = z.infer<typeof createBranchSchema>;

export async function createBranchWithBootstrapAction(raw: CreateBranchInput) {
  const parsed = createBranchSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Données invalides." };
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
    return { ok: false as const, message: "Vous n’appartenez pas à cette organisation." };
  }

  if (!isAdmin && membership && !["owner", "gestionnaire"].includes(membership.role)) {
    return { ok: false as const, message: "Permission insuffisante pour créer une branche." };
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

  try {
    const created = await prisma.$transaction(async (tx) => {
      const branch = await tx.branch.create({
        data: {
          organizationId: input.organizationId,
          type: input.type,
          name: input.name,
          code,
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
        type: input.type,
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
    const message = e instanceof Error ? e.message : "Création de branche impossible.";
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
      createdAt: true,
      _count: {
        select: {
          trajets: true,
          hotelRoomTypes: true,
          shopCategories: true,
          members: true,
        },
      },
    },
  });

  return { ok: true as const, data: branches };
}
