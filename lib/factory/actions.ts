"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { branchBasePath, usineRoutes } from "@/lib/branch/paths";
import { isUsine } from "@/lib/branch/usine";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/prisma/client";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import { consumeShopServiceFloatInTx } from "@/lib/hotel/service-stock";
import { remainingFloat } from "@/lib/hotel/service-stock-print";
import {
  notifyFactoryCreditCreated,
  notifyFactoryCreditExtension,
  notifyFactoryCreditPayment,
  notifyFactoryReservation,
} from "@/lib/factory/notifications";
import { assertBranchPrivilege } from "@/lib/branch/privileges";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import type { PrivilegeActionName } from "@/lib/branch/privilege-seed";

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function isUniqueConflict(err: unknown) {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

async function ctx(
  organizationId: string,
  branchId: string,
  privilege?: { resource: string; action: PrivilegeActionName },
) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Non authentifié.");
  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    branchId,
  );
  if (!branch || branch.organizationId !== organizationId) {
    throw new Error("Branche inaccessible.");
  }
  if (!isUsine(branch.type)) throw new Error("Module usine requis.");
  if (privilege) {
    await assertBranchPrivilege({
      organizationId,
      branchId,
      resource: privilege.resource,
      action: privilege.action,
    });
  }
  return { user: session.user, branch };
}

function revalidateFactory(organizationId: string, branchId: string) {
  const base = branchBasePath(organizationId, branchId);
  revalidatePath(base);
  revalidatePath(usineRoutes.pos(organizationId, branchId));
  revalidatePath(usineRoutes.credits(organizationId, branchId));
  revalidatePath(usineRoutes.clients(organizationId, branchId));
  revalidatePath(usineRoutes.demandes(organizationId, branchId));
  revalidatePath(usineRoutes.reservations(organizationId, branchId));
  revalidatePath(usineRoutes.produits(organizationId, branchId));
  revalidatePath(usineRoutes.depot(organizationId, branchId));
  revalidatePath(usineRoutes.production(organizationId, branchId));
  revalidatePath(usineRoutes.fournisseurs(organizationId, branchId));
  revalidatePath(usineRoutes.serviceStock(organizationId, branchId));
  revalidatePath(`${base}/bons-commande`);
}

async function nextNumber(
  branchId: string,
  prefix: "CR" | "LOT",
  tx: Prisma.TransactionClient | typeof prisma = prisma,
) {
  if (prefix === "CR") {
    const n = await tx.factoryCredit.count({ where: { branchId } });
    return `CR-${String(n + 1).padStart(5, "0")}`;
  }
  const n = await tx.factoryBatch.count({ where: { branchId } });
  return `LOT-${String(n + 1).padStart(5, "0")}`;
}

/** Float libre par produit (rem − holds réservation), à appeler dans une tx si besoin. */
async function factoryFloatFreeByProduct(
  tx: Prisma.TransactionClient | typeof prisma,
  branchId: string,
  opts?: { excludeReservationId?: string },
) {
  const session = await tx.serviceStockSession.findFirst({
    where: {
      branchId,
      status: "OPEN",
      openingConfirmedAt: { not: null },
    },
    include: {
      lines: { include: { shopProduct: true } },
    },
  });
  if (!session) return new Map<string, { free: number; price: number; name: string }>();

  const holds = await tx.factoryReservationLine.findMany({
    where: {
      reservation: {
        branchId,
        status: "HOLD",
        ...(opts?.excludeReservationId
          ? { id: { not: opts.excludeReservationId } }
          : {}),
      },
    },
  });
  const holdMap = new Map<string, number>();
  for (const h of holds) {
    holdMap.set(h.shopProductId, (holdMap.get(h.shopProductId) ?? 0) + h.qty);
  }

  const map = new Map<string, { free: number; price: number; name: string }>();
  for (const l of session.lines) {
    if (!l.shopProductId || !l.shopProduct) continue;
    const rem = remainingFloat(l);
    const held = holdMap.get(l.shopProductId) ?? 0;
    map.set(l.shopProductId, {
      free: Math.max(0, rem - held),
      price: l.unitPriceUsd || l.shopProduct.price,
      name: l.shopProduct.name,
    });
  }
  return map;
}

function startOfToday(tzDate = new Date()) {
  const d = new Date(tzDate);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function listFactorySuppliersAction(
  organizationId: string,
  branchId: string,
  includeInactive = true,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_FOURNISSEURS, action: 'VIEW' });
  return prisma.branchSupplier.findMany({
    where: {
      branchId,
      ...(includeInactive ? {} : { active: true }),
    },
    orderBy: { name: "asc" },
  });
}

export async function upsertFactorySupplierAction(input: {
  organizationId: string;
  branchId: string;
  id?: string;
  name: string;
  phone?: string;
  contactName?: string;
  address?: string;
  notes?: string;
  active?: boolean;
}) {
  await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_FOURNISSEURS, action: 'UPDATE' });
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Nom du fournisseur requis.");
  const data = {
    name,
    phone: input.phone?.trim() || null,
    contactName: input.contactName?.trim() || null,
    address: input.address?.trim() || null,
    notes: input.notes?.trim() || null,
    active: input.active !== false,
  };
  const row = input.id
    ? await prisma.branchSupplier.update({
        where: { id: input.id },
        data,
      })
    : await prisma.branchSupplier.create({
        data: { branchId: input.branchId, ...data },
      });
  revalidateFactory(input.organizationId, input.branchId);
  return row;
}

export async function listFactoryCustomersAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_CLIENTS, action: 'VIEW' });
  return prisma.factoryCustomer.findMany({
    where: { branchId },
    orderBy: { name: "asc" },
    include: {
      affiliateBranch: { select: { id: true, name: true, type: true } },
      user: { select: { id: true, email: true, name: true } },
      _count: {
        select: { credits: true, reservations: true, orderRequests: true },
      },
    },
  });
}

/** Branches BOUTIQUE / RESTAURANT de l’org (hors usine courante) pour affiliation interne. */
export async function listAffiliateBranchOptionsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_CLIENTS, action: 'VIEW' });
  return prisma.branch.findMany({
    where: {
      organizationId,
      id: { not: branchId },
      type: { in: ["BOUTIQUE", "RESTAURANT"] },
      status: "ACTIVE",
    },
    select: { id: true, name: true, type: true, code: true },
    orderBy: { name: "asc" },
  });
}

export async function upsertFactoryCustomerAction(input: {
  organizationId: string;
  branchId: string;
  id?: string;
  name: string;
  phone?: string;
  contactName?: string;
  companyName?: string;
  email?: string;
  notes?: string;
  deliveryAddress?: string;
  deliveryCity?: string;
  affiliateBranchId?: string | null;
  active?: boolean;
}) {
  const { branch } = await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_CLIENTS, action: 'UPDATE' });
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Nom du client requis.");
  const phone = input.phone?.trim() || null;
  if (!phone) {
    throw new Error("Téléphone obligatoire pour un client usine / affilié.");
  }

  let affiliateBranchId: string | null | undefined = input.affiliateBranchId;
  if (affiliateBranchId !== undefined) {
    affiliateBranchId = affiliateBranchId?.trim() || null;
    if (affiliateBranchId) {
      const linked = await prisma.branch.findFirst({
        where: {
          id: affiliateBranchId,
          organizationId: branch.organizationId,
          type: { in: ["BOUTIQUE", "RESTAURANT"] },
        },
        select: { id: true },
      });
      if (!linked) throw new Error("Branche affiliée invalide.");
    }
  }

  const data = {
    name,
    phone,
    contactName: input.contactName?.trim() || null,
    companyName: input.companyName?.trim() || null,
    email: input.email?.trim().toLowerCase() || null,
    notes: input.notes?.trim() || null,
    deliveryAddress: input.deliveryAddress?.trim() || null,
    deliveryCity: input.deliveryCity?.trim() || null,
    ...(affiliateBranchId !== undefined ? { affiliateBranchId } : {}),
    active: input.active !== false,
  };
  const isCreate = !input.id;
  const row = input.id
    ? await prisma.factoryCustomer.update({ where: { id: input.id }, data })
    : await prisma.factoryCustomer.create({
        data: {
          branchId: input.branchId,
          ...data,
          affiliateBranchId: affiliateBranchId ?? null,
        },
      });

  if (isCreate && row.phone?.trim()) {
    const { notifyFactoryCustomerWelcome } = await import(
      "@/lib/factory/notifications"
    );
    void notifyFactoryCustomerWelcome({
      branchId: input.branchId,
      customerId: row.id,
      customerName: row.contactName || row.name,
      phone: row.phone,
      companyName: row.companyName,
    });
  }

  revalidateFactory(input.organizationId, input.branchId);
  return row;
}

function affiliatePortalLoginUrl(orgSlug: string): string {
  const base = (
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
    "http://localhost:3000"
  ).replace(/\/$/, "");
  const portalPath = `/${orgSlug}/usine-affilie`;
  return `${base}/auth/sign-in?callbackUrl=${encodeURIComponent(portalPath)}`;
}

export async function inviteFactoryCustomerAccountAction(input: {
  organizationId: string;
  branchId: string;
  customerId: string;
}): Promise<
  | {
      ok: true;
      email: string;
      temporaryPassword: string;
      whatsappSent: boolean;
    }
  | { ok: false; message: string }
> {
  try {
    const h = await headers();
    await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_CLIENTS, action: 'UPDATE' });
    const customer = await prisma.factoryCustomer.findFirst({
      where: { id: input.customerId, branchId: input.branchId },
    });
    if (!customer) return { ok: false, message: "Client introuvable." };
    if (customer.userId) {
      return { ok: false, message: "Ce client a déjà un compte." };
    }
    if (!customer.phone?.trim()) {
      return {
        ok: false,
        message: "Téléphone requis pour envoyer l’invitation WhatsApp.",
      };
    }

    const org = await prisma.organization.findUnique({
      where: { id: input.organizationId },
      select: { name: true, slug: true },
    });
    if (!org) return { ok: false, message: "Organisation introuvable." };

    const displayName =
      customer.contactName?.trim() ||
      customer.name.trim() ||
      customer.companyName?.trim() ||
      "Affilié";
    const loginUrl = affiliatePortalLoginUrl(org.slug);
    const portalUrl = (
      process.env.BETTER_AUTH_URL ||
      process.env.NEXT_PUBLIC_BETTER_AUTH_URL ||
      "http://localhost:3000"
    ).replace(/\/$/, "") + `/${org.slug}/usine-affilie`;

    const { resolveMemberEmail } = await import("@/lib/member-email");
    const { generateSecurePassword } = await import("@/lib/generate-password");
    const { stashAdminCreatedUserPlainPassword } = await import(
      "@/lib/admin-created-user-password"
    );
    const {
      notifyFactoryAffiliatePortalAccess,
    } = await import("@/lib/factory/notifications");
    const { isKlamboWhatsAppConfigured } = await import("@/lib/klambo-whatsapp");

    const resolvedEmail = await resolveMemberEmail({
      email: customer.email ?? "",
      name: displayName,
      organizationSlug: org.slug,
    });
    if (!resolvedEmail.ok) return resolvedEmail;

    const emailLower = resolvedEmail.email;
    const existingUser = await prisma.user.findUnique({
      where: { email: emailLower },
      select: { id: true },
    });
    if (existingUser) {
      const taken = await prisma.factoryCustomer.findFirst({
        where: { userId: existingUser.id },
        select: { id: true },
      });
      if (taken && taken.id !== customer.id) {
        return {
          ok: false,
          message: "Cet email est déjà lié à un autre client usine.",
        };
      }
      // Affilié = lien FactoryCustomer.userId uniquement (pas de Member org).
      await prisma.factoryCustomer.update({
        where: { id: customer.id },
        data: {
          userId: existingUser.id,
          email: emailLower,
        },
      });

      let whatsappSent = false;
      if (isKlamboWhatsAppConfigured()) {
        await notifyFactoryAffiliatePortalAccess({
          branchId: input.branchId,
          customerId: customer.id,
          customerName: displayName,
          phone: customer.phone,
          email: emailLower,
          portalUrl,
        });
        whatsappSent = true;
      }

      revalidateFactory(input.organizationId, input.branchId);
      return {
        ok: true,
        email: emailLower,
        temporaryPassword: "(compte existant — mot de passe inchangé)",
        whatsappSent,
      };
    }

    const password = generateSecurePassword(16);
    stashAdminCreatedUserPlainPassword(emailLower, password, {
      phone: customer.phone,
      branchId: input.branchId,
      organizationName: org.name,
      role: "affilie",
      loginUrl,
    });

    let userId: string | null = null;
    try {
      const created = await auth.api.createUser({
        body: {
          email: emailLower,
          name: displayName,
          password,
          role: "user",
        },
        headers: h,
      });
      const user = (created as { user?: { id: string } } | null)?.user;
      if (!user?.id) {
        return { ok: false, message: "Création du compte impossible." };
      }
      userId = user.id;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          phone: customer.phone.trim(),
          mustChangePassword: true,
        },
      });

      await prisma.factoryCustomer.update({
        where: { id: customer.id },
        data: { userId: user.id, email: emailLower },
      });

      revalidateFactory(input.organizationId, input.branchId);
      return {
        ok: true,
        email: emailLower,
        temporaryPassword: password,
        whatsappSent: Boolean(customer.phone?.trim() && isKlamboWhatsAppConfigured()),
      };
    } catch (e) {
      const { consumeAdminCreatedUserPlainPassword } = await import(
        "@/lib/admin-created-user-password"
      );
      consumeAdminCreatedUserPlainPassword(emailLower);
      if (userId) {
        await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
      }
      throw e;
    }
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Invitation impossible.",
    };
  }
}

export async function listFactoryProductsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_DEPOT, action: 'VIEW' });
  return prisma.shopProduct.findMany({
    where: { branchId },
    include: { category: { select: { name: true } } },
    orderBy: [{ productKind: "asc" }, { name: "asc" }],
  });
}

export async function listFactoryDepotAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_DEPOT, action: 'VIEW' });
  return prisma.shopProduct.findMany({
    where: { branchId, active: true },
    include: { category: { select: { name: true } } },
    orderBy: [{ productKind: "asc" }, { name: "asc" }],
  });
}

export async function listFactoryRecipesAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_PRODUCTION, action: 'VIEW' });
  return prisma.factoryRecipe.findMany({
    where: { branchId },
    include: {
      shopProduct: { select: { id: true, name: true } },
      lines: {
        include: { consumable: { select: { id: true, name: true, stockQty: true } } },
      },
      _count: { select: { batches: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertFactoryRecipeAction(input: {
  organizationId: string;
  branchId: string;
  id?: string;
  shopProductId: string;
  outputQty: number;
  lines: { consumableProductId: string; qtyPerBatch: number }[];
  active?: boolean;
}) {
  await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_PRODUCTION, action: 'UPDATE' });
  if (!input.lines.length) throw new Error("Ajoutez au moins un consommable.");
  const outputQty = Math.max(1, Math.floor(input.outputQty));
  const dataLines = input.lines.map((l) => ({
    consumableProductId: l.consumableProductId,
    qtyPerBatch: l.qtyPerBatch,
  }));
  const row = await prisma.$transaction(async (tx) => {
    if (input.id) {
      await tx.factoryRecipeLine.deleteMany({ where: { recipeId: input.id } });
      return tx.factoryRecipe.update({
        where: { id: input.id },
        data: {
          shopProductId: input.shopProductId,
          outputQty,
          active: input.active !== false,
          lines: { create: dataLines },
        },
      });
    }
    return tx.factoryRecipe.create({
      data: {
        branchId: input.branchId,
        shopProductId: input.shopProductId,
        outputQty,
        active: input.active !== false,
        lines: { create: dataLines },
      },
    });
  });
  revalidateFactory(input.organizationId, input.branchId);
  return row;
}

export async function listFactoryBatchesAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_PRODUCTION, action: 'VIEW' });
  return prisma.factoryBatch.findMany({
    where: { branchId },
    include: {
      recipe: { include: { shopProduct: { select: { name: true } } } },
      outputProduct: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
}

export async function validateFactoryBatchAction(input: {
  organizationId: string;
  branchId: string;
  recipeId: string;
  multiplier?: number;
  notes?: string;
}) {
  const { user } = await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_PRODUCTION, action: 'CREATE' });
  const multiplier = Math.max(1, input.multiplier ?? 1);
  const recipe = await prisma.factoryRecipe.findFirst({
    where: { id: input.recipeId, branchId: input.branchId, active: true },
    include: {
      lines: { include: { consumable: true } },
      shopProduct: true,
    },
  });
  if (!recipe) throw new Error("Recette introuvable.");
  const outputQty = Math.round(recipe.outputQty * multiplier);

  const batch = await prisma.$transaction(async (tx) => {
    for (const line of recipe.lines) {
      const need = Math.round(line.qtyPerBatch * multiplier);
      const updated = await tx.shopProduct.updateMany({
        where: {
          id: line.consumableProductId,
          branchId: input.branchId,
          stockQty: { gte: need },
        },
        data: { stockQty: { decrement: need } },
      });
      if (updated.count !== 1) {
        const current = await tx.shopProduct.findFirst({
          where: { id: line.consumableProductId, branchId: input.branchId },
          select: { name: true, stockQty: true },
        });
        throw new Error(
          `Stock insuffisant : ${current?.name ?? line.consumable.name} (besoin ${need}, dispo ${current?.stockQty ?? 0}). Passez un bon de commande.`,
        );
      }
    }

    await tx.shopProduct.update({
      where: { id: recipe.shopProductId },
      data: { stockQty: { increment: outputQty } },
    });

    let number = await nextNumber(input.branchId, "LOT", tx);
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const created = await tx.factoryBatch.create({
          data: {
            branchId: input.branchId,
            number,
            status: "VALIDATED",
            recipeId: recipe.id,
            multiplier,
            outputProductId: recipe.shopProductId,
            outputQty,
            notes: input.notes?.trim() || null,
            producedAt: new Date(),
            validatedByUserId: user.id,
          },
        });
        for (const line of recipe.lines) {
          const need = Math.round(line.qtyPerBatch * multiplier);
          await tx.shopStockMovement.create({
            data: {
              branchId: input.branchId,
              productId: line.consumableProductId,
              kind: "SORTIE",
              quantity: need,
              note: `Lot ${number}`,
            },
          });
        }
        await tx.shopStockMovement.create({
          data: {
            branchId: input.branchId,
            productId: recipe.shopProductId,
            kind: "ENTREE",
            quantity: outputQty,
            note: `Lot ${number}`,
          },
        });
        return created;
      } catch (err) {
        if (!isUniqueConflict(err) || attempt === 5) throw err;
        number = await nextNumber(input.branchId, "LOT", tx);
      }
    }
    throw new Error("Impossible d’attribuer un numéro de lot.");
  });

  revalidateFactory(input.organizationId, input.branchId);
  return batch;
}

export async function listFactoryCreditsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_CREDITS, action: 'VIEW' });
  return prisma.factoryCredit.findMany({
    where: { branchId },
    include: {
      customer: true,
      lines: true,
      payments: { orderBy: { paidAt: "asc" } },
      extensions: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getFactoryCreditAction(
  organizationId: string,
  branchId: string,
  creditId: string,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_CREDITS, action: 'VIEW' });
  const credit = await prisma.factoryCredit.findFirst({
    where: { id: creditId, branchId },
    include: {
      customer: true,
      lines: true,
      payments: { orderBy: { paidAt: "asc" } },
      extensions: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!credit) throw new Error("Crédit introuvable.");
  return credit;
}

export async function listFactoryFloatProductsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_CREDITS, action: 'VIEW' });
  const session = await prisma.serviceStockSession.findFirst({
    where: {
      branchId,
      status: "OPEN",
      openingConfirmedAt: { not: null },
    },
    include: {
      lines: { include: { shopProduct: true } },
    },
  });
  if (!session) return [];
  const holds = await prisma.factoryReservationLine.findMany({
    where: { reservation: { branchId, status: "HOLD" } },
  });
  const holdMap = new Map<string, number>();
  for (const h of holds) {
    holdMap.set(h.shopProductId, (holdMap.get(h.shopProductId) ?? 0) + h.qty);
  }
  return session.lines
    .filter((l) => l.shopProduct)
    .map((l) => {
      const rem = remainingFloat(l);
      const held = holdMap.get(l.shopProductId!) ?? 0;
      return {
        id: l.shopProductId!,
        name: l.shopProduct!.name,
        price: l.unitPriceUsd || l.shopProduct!.price,
        remaining: rem,
        reserved: held,
        free: Math.max(0, rem - held),
        finishedFamily: l.shopProduct!.finishedFamily ?? null,
      };
    });
}

export async function createFactoryCreditAction(input: {
  organizationId: string;
  branchId: string;
  customerId?: string;
  customer?: {
    name: string;
    phone: string;
    contactName?: string;
    companyName?: string;
  };
  dueAt: string;
  lines: { shopProductId: string; qty: number; unitPriceUsd: number }[];
  signedOnPaper?: boolean;
  deliveryAddress?: string;
  deliveryCity?: string;
  requestedDeliveryAt?: string | null;
}) {
  const { user } = await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_CREDITS, action: 'CREATE' });
  if (!input.lines.length) throw new Error("Ajoutez au moins un produit.");
  const dueAt = new Date(input.dueAt);
  dueAt.setHours(0, 0, 0, 0);
  if (Number.isNaN(dueAt.getTime()) || dueAt < startOfToday()) {
    throw new Error("L’échéance doit être aujourd’hui ou plus tard.");
  }

  let customerId = input.customerId;
  if (!customerId) {
    const name = input.customer?.name.trim() ?? "";
    const phone = input.customer?.phone.trim() ?? "";
    if (name.length < 2) throw new Error("Nom du client requis.");
    if (!phone) throw new Error("Téléphone obligatoire pour un crédit.");
    const created = await upsertFactoryCustomerAction({
      organizationId: input.organizationId,
      branchId: input.branchId,
      name,
      phone,
      contactName: input.customer?.contactName,
      companyName: input.customer?.companyName,
    });
    customerId = created.id;
  }
  const customer = await prisma.factoryCustomer.findFirst({
    where: { id: customerId, branchId: input.branchId },
  });
  if (!customer) throw new Error("Client introuvable.");
  if (!customer.phone?.trim()) {
    throw new Error("Téléphone obligatoire pour un crédit.");
  }

  const products = await prisma.shopProduct.findMany({
    where: {
      id: { in: input.lines.map((l) => l.shopProductId) },
      branchId: input.branchId,
      productKind: "FINISHED",
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = input.lines.map((l) => {
    const p = byId.get(l.shopProductId);
    if (!p) throw new Error("Produit fini introuvable.");
    const qty = Math.floor(Number(l.qty) || 0);
    if (qty < 1) throw new Error(`Quantité invalide pour « ${p.name} ».`);
    const unitPriceUsd = roundMoney(l.unitPriceUsd);
    if (!(unitPriceUsd > 0)) {
      throw new Error(`Prix invalide pour « ${p.name} ».`);
    }
    return {
      shopProductId: p.id,
      nameSnapshot: p.name,
      qty,
      unitPriceUsd,
      lineTotalUsd: roundMoney(unitPriceUsd * qty),
    };
  });
  const totalUsd = roundMoney(lines.reduce((s, l) => s + l.lineTotalUsd, 0));
  const rate = await getActiveExchangeRate(input.branchId);
  const marketerDisplayName =
    user.name?.trim() || user.email || "Marketeur";
  const requestedDeliveryAt = input.requestedDeliveryAt
    ? new Date(input.requestedDeliveryAt)
    : null;
  if (
    requestedDeliveryAt &&
    Number.isNaN(requestedDeliveryAt.getTime())
  ) {
    throw new Error("Date de livraison invalide.");
  }

  const credit = await prisma.$transaction(async (tx) => {
    await consumeShopServiceFloatInTx(
      tx,
      input.branchId,
      lines.map((l) => ({
        productId: l.shopProductId,
        quantity: l.qty,
        name: l.nameSnapshot,
      })),
    );
    let number = await nextNumber(input.branchId, "CR", tx);
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        return await tx.factoryCredit.create({
          data: {
            branchId: input.branchId,
            number,
            customerId: customer.id,
            marketerUserId: user.id,
            marketerDisplayName,
            status: "OPEN",
            dueAt,
            originalDueAt: dueAt,
            totalUsd,
            paidUsd: 0,
            fxUsdToCdf: rate?.rate ?? null,
            documentIssuedAt: new Date(),
            signedAt: input.signedOnPaper ? new Date() : null,
            deliveryAddress:
              input.deliveryAddress?.trim() || customer.deliveryAddress || null,
            deliveryCity:
              input.deliveryCity?.trim() || customer.deliveryCity || null,
            requestedDeliveryAt,
            lines: { create: lines },
          },
          include: { customer: true, lines: true },
        });
      } catch (err) {
        if (!isUniqueConflict(err) || attempt === 5) throw err;
        number = await nextNumber(input.branchId, "CR", tx);
      }
    }
    throw new Error("Impossible d’attribuer un numéro de crédit.");
  });

  void notifyFactoryCreditCreated({
    branchId: input.branchId,
    creditId: credit.id,
    number: credit.number,
    customerName: customer.name,
    phone: customer.phone,
    qtyLabel: lines.map((l) => `${l.qty}× ${l.nameSnapshot}`).join(", "),
    totalUsd,
    dueAt,
  });
  revalidateFactory(input.organizationId, input.branchId);
  return credit;
}

export async function markFactoryCreditSignedAction(input: {
  organizationId: string;
  branchId: string;
  creditId: string;
}) {
  await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_CREDITS, action: 'UPDATE' });
  const updated = await prisma.factoryCredit.updateMany({
    where: { id: input.creditId, branchId: input.branchId },
    data: { signedAt: new Date() },
  });
  if (updated.count !== 1) throw new Error("Crédit introuvable.");
  const row = await prisma.factoryCredit.findFirst({
    where: { id: input.creditId, branchId: input.branchId },
  });
  revalidateFactory(input.organizationId, input.branchId);
  return row;
}

export async function extendFactoryCreditAction(input: {
  organizationId: string;
  branchId: string;
  creditId: string;
  newDueAt: string;
  reason: string;
}) {
  const { user } = await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_CREDITS, action: 'UPDATE' });
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error("Motif de prolongation requis.");
  const credit = await prisma.factoryCredit.findFirst({
    where: { id: input.creditId, branchId: input.branchId },
    include: { customer: true },
  });
  if (!credit) throw new Error("Crédit introuvable.");
  if (credit.status === "SETTLED" || credit.status === "CANCELLED") {
    throw new Error("Crédit clôturé.");
  }
  const newDueAt = new Date(input.newDueAt);
  newDueAt.setHours(0, 0, 0, 0);
  if (newDueAt <= credit.dueAt) {
    throw new Error("La nouvelle échéance doit être après l’actuelle.");
  }
  await prisma.$transaction([
    prisma.factoryCreditExtension.create({
      data: {
        creditId: credit.id,
        previousDueAt: credit.dueAt,
        newDueAt,
        reason,
        createdByUserId: user.id,
      },
    }),
    prisma.factoryCredit.update({
      where: { id: credit.id },
      data: { dueAt: newDueAt, reminderSentAt: null, dueDayReminderSentAt: null },
    }),
  ]);
  void notifyFactoryCreditExtension({
    branchId: input.branchId,
    creditId: credit.id,
    number: credit.number,
    customerName: credit.customer.name,
    phone: credit.customer.phone,
    newDueAt,
    reason,
  });
  revalidateFactory(input.organizationId, input.branchId);
}

export async function payFactoryCreditAction(input: {
  organizationId: string;
  branchId: string;
  creditId: string;
  amountUsd: number;
  method?: "CASH" | "MOBILE_MONEY" | "BANK";
}) {
  const { user } = await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_CREDITS, action: 'UPDATE' });
  const amountUsd = roundMoney(input.amountUsd);
  if (amountUsd <= 0) throw new Error("Montant invalide.");
  const method = input.method ?? "CASH";
  let cashSessionId: string | null = null;
  if (method === "CASH") {
    const session = await prisma.cashSession.findFirst({
      where: { branchId: input.branchId, status: "OPEN", openedByUserId: user.id },
      select: { id: true },
    });
    if (!session) {
      throw new Error("Ouvrez une session de caisse pour encaisser en cash.");
    }
    cashSessionId = session.id;
  }
  const rate = await getActiveExchangeRate(input.branchId);

  const result = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        number: string;
        totalUsd: number;
        paidUsd: number;
        status: string;
        dueAt: Date;
        customerName: string;
        customerPhone: string | null;
      }>
    >`
      SELECT c.id, c.number, c."totalUsd", c."paidUsd", c.status, c."dueAt",
             cu.name AS "customerName", cu.phone AS "customerPhone"
      FROM "FactoryCredit" c
      JOIN "FactoryCustomer" cu ON cu.id = c."customerId"
      WHERE c.id = ${input.creditId} AND c."branchId" = ${input.branchId}
      FOR UPDATE OF c
    `;
    const credit = locked[0];
    if (!credit) throw new Error("Crédit introuvable.");
    if (credit.status === "SETTLED" || credit.status === "CANCELLED") {
      throw new Error("Crédit déjà clôturé.");
    }
    const remaining = roundMoney(credit.totalUsd - credit.paidUsd);
    if (amountUsd - remaining > 0.01) {
      throw new Error(`Montant supérieur au restant (${remaining} USD).`);
    }
    const remainingAfter = roundMoney(remaining - amountUsd);
    const kind =
      remainingAfter <= 0.01
        ? "SOLDE"
        : credit.paidUsd <= 0.01
          ? "ACOMPTE"
          : "COMPLEMENT";
    const paidUsd = roundMoney(credit.paidUsd + amountUsd);
    const status = paidUsd + 0.01 >= credit.totalUsd ? "SETTLED" : "PARTIAL";
    const count = await tx.payment.count({ where: { branchId: input.branchId } });
    const receiptNumber = `RC-${String(count + 1).padStart(5, "0")}`;
    await tx.payment.create({
      data: {
        branchId: input.branchId,
        factoryCreditId: credit.id,
        installmentKind: kind,
        cashSessionId,
        receiptNumber,
        method,
        amountCdf: roundMoney(amountUsd * (rate?.rate ?? 1)),
        amountForeign: amountUsd,
        foreignCurrency: "USD",
        exchangeRateUsed: rate?.rate ?? null,
        cashierUserId: user.id,
        note: `${kind} ${credit.number}`,
      },
    });
    const updated = await tx.factoryCredit.updateMany({
      where: {
        id: credit.id,
        branchId: input.branchId,
        paidUsd: credit.paidUsd,
        status: { in: ["OPEN", "PARTIAL"] },
      },
      data: { paidUsd, status },
    });
    if (updated.count !== 1) {
      throw new Error("Paiement concurrent détecté. Réessayez.");
    }
    return {
      kind,
      status,
      remainingUsd: Math.max(0, remainingAfter),
      credit,
    };
  });

  void notifyFactoryCreditPayment({
    branchId: input.branchId,
    creditId: input.creditId,
    number: result.credit.number,
    customerName: result.credit.customerName,
    phone: result.credit.customerPhone,
    kind: result.kind,
    amountUsd,
    remainingUsd: result.remainingUsd,
    dueAt: result.credit.dueAt,
    settled: result.status === "SETTLED",
  });
  revalidateFactory(input.organizationId, input.branchId);
  return {
    kind: result.kind,
    status: result.status,
    remainingUsd: result.remainingUsd,
  };
}

export async function listFactoryReservationsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_RESERVATIONS, action: 'VIEW' });
  await expireFactoryReservations(branchId);
  return prisma.factoryReservation.findMany({
    where: { branchId },
    include: {
      customer: true,
      lines: { include: { shopProduct: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

async function expireFactoryReservations(branchId: string) {
  const expired = await prisma.factoryReservation.findMany({
    where: { branchId, status: "HOLD", holdUntil: { lt: new Date() } },
    include: { customer: true, lines: true },
  });
  for (const row of expired) {
    await prisma.factoryReservation.update({
      where: { id: row.id },
      data: { status: "EXPIRED" },
    });
    void notifyFactoryReservation({
      branchId,
      reservationId: row.id,
      customerName: row.customer.name,
      phone: row.customer.phone,
      qtyLabel: row.lines.map((l) => `${l.qty}`).join(", "),
      holdUntil: row.holdUntil,
      expired: true,
    });
  }
}

export async function createFactoryReservationAction(input: {
  organizationId: string;
  branchId: string;
  customerId: string;
  creditId?: string;
  holdDays?: number;
  lines: { shopProductId: string; qty: number }[];
}) {
  const { user } = await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_RESERVATIONS, action: 'CREATE' });
  if (!input.lines.length) throw new Error("Ajoutez au moins un produit.");
  const customer = await prisma.factoryCustomer.findFirst({
    where: { id: input.customerId, branchId: input.branchId },
  });
  if (!customer) throw new Error("Client introuvable.");
  if (!customer.active) throw new Error("Client inactif.");

  const holdUntil = new Date();
  holdUntil.setDate(holdUntil.getDate() + Math.max(1, input.holdDays ?? 7));

  const reservation = await prisma.$transaction(async (tx) => {
    const freeMap = await factoryFloatFreeByProduct(tx, input.branchId);
    const createLines: { shopProductId: string; qty: number }[] = [];
    for (const line of input.lines) {
      const qty = Math.floor(Number(line.qty) || 0);
      if (qty < 1) throw new Error("Quantité réservation invalide.");
      const available = freeMap.get(line.shopProductId)?.free ?? 0;
      if (qty > available) {
        throw new Error("Quantité supérieure au stock auxiliaire libre.");
      }
      createLines.push({ shopProductId: line.shopProductId, qty });
    }
    return tx.factoryReservation.create({
      data: {
        branchId: input.branchId,
        customerId: input.customerId,
        marketerUserId: user.id,
        marketerDisplayName: user.name?.trim() || user.email || "Marketeur",
        holdUntil,
        creditId: input.creditId || null,
        lines: { create: createLines },
      },
      include: { lines: { include: { shopProduct: true } } },
    });
  });

  void notifyFactoryReservation({
    branchId: input.branchId,
    reservationId: reservation.id,
    customerName: customer.name,
    phone: customer.phone,
    qtyLabel: reservation.lines
      .map((l) => `${l.qty}× ${l.shopProduct.name}`)
      .join(", "),
    holdUntil,
  });
  revalidateFactory(input.organizationId, input.branchId);
  return reservation;
}

export async function pickFactoryReservationAction(input: {
  organizationId: string;
  branchId: string;
  reservationId: string;
}) {
  await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_RESERVATIONS, action: 'UPDATE' });
  await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ id: string; status: string; creditId: string | null }>
    >`
      SELECT id, status, "creditId"
      FROM "FactoryReservation"
      WHERE id = ${input.reservationId} AND "branchId" = ${input.branchId}
      FOR UPDATE
    `;
    const row = locked[0];
    if (!row || row.status !== "HOLD") {
      throw new Error("Réservation inactive.");
    }
    // Si déjà liée à un crédit, le float a déjà été débité à la création du crédit.
    if (!row.creditId) {
      const lines = await tx.factoryReservationLine.findMany({
        where: { reservationId: row.id },
        include: { shopProduct: { select: { name: true } } },
      });
      if (!lines.length) throw new Error("Réservation sans lignes.");
      await consumeShopServiceFloatInTx(
        tx,
        input.branchId,
        lines.map((l) => ({
          productId: l.shopProductId,
          quantity: l.qty,
          name: l.shopProduct.name,
        })),
        { excludeReservationId: row.id },
      );
    }
    const updated = await tx.factoryReservation.updateMany({
      where: { id: row.id, branchId: input.branchId, status: "HOLD" },
      data: { status: "PICKED" },
    });
    if (updated.count !== 1) {
      throw new Error("Réservation déjà traitée.");
    }
  });
  revalidateFactory(input.organizationId, input.branchId);
}

export async function cancelFactoryReservationAction(input: {
  organizationId: string;
  branchId: string;
  reservationId: string;
}) {
  await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_RESERVATIONS, action: 'UPDATE' });
  const updated = await prisma.factoryReservation.updateMany({
    where: {
      id: input.reservationId,
      branchId: input.branchId,
      status: "HOLD",
    },
    data: { status: "CANCELLED" },
  });
  if (updated.count !== 1) {
    throw new Error("Réservation introuvable ou déjà traitée.");
  }
  revalidateFactory(input.organizationId, input.branchId);
}

export async function factoryCreditsOpenSummaryAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_CREDITS, action: 'VIEW' });
  const rows = await prisma.factoryCredit.findMany({
    where: { branchId, status: { in: ["OPEN", "PARTIAL"] } },
    select: { totalUsd: true, paidUsd: true },
  });
  return {
    count: rows.length,
    remainingUsd: roundMoney(
      rows.reduce((s, r) => s + (r.totalUsd - r.paidUsd), 0),
    ),
  };
}

export async function listFactoryOrderRequestsAction(
  organizationId: string,
  branchId: string,
  status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "ALL",
) {
  await ctx(organizationId, branchId, { resource: DASH_CARD.USINE_CLIENTS, action: 'VIEW' });
  return prisma.factoryOrderRequest.findMany({
    where: {
      branchId,
      ...(status && status !== "ALL" ? { status } : {}),
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          companyName: true,
          phone: true,
          contactName: true,
        },
      },
      lines: true,
      credit: { select: { id: true, number: true } },
    },
  });
}

export async function rejectFactoryOrderRequestAction(input: {
  organizationId: string;
  branchId: string;
  requestId: string;
  reason: string;
}) {
  const { user } = await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_CLIENTS, action: 'UPDATE' });
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error("Motif de refus requis.");
  const req = await prisma.factoryOrderRequest.findFirst({
    where: { id: input.requestId, branchId: input.branchId },
    include: { customer: true, lines: true },
  });
  if (!req) throw new Error("Demande introuvable.");
  if (req.status !== "PENDING") throw new Error("Demande déjà traitée.");

  const claimed = await prisma.factoryOrderRequest.updateMany({
    where: {
      id: req.id,
      branchId: input.branchId,
      status: "PENDING",
    },
    data: {
      status: "REJECTED",
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
      rejectReason: reason,
    },
  });
  if (claimed.count !== 1) {
    throw new Error("Demande déjà traitée.");
  }
  const { notifyFactoryOrderRequestRejected } = await import(
    "@/lib/factory/notifications"
  );
  void notifyFactoryOrderRequestRejected({
    branchId: input.branchId,
    requestId: req.id,
    customerName: req.customer.name,
    phone: req.customer.phone,
    reason,
  });
  revalidateFactory(input.organizationId, input.branchId);
}

export async function approveFactoryOrderRequestAction(input: {
  organizationId: string;
  branchId: string;
  requestId: string;
  dueAt: string;
  /** Quantités à livrer (peut être partielle). Lignes absentes / qty 0 = non livrées. */
  lines?: { shopProductId: string; qty: number; unitPriceUsd?: number }[];
}) {
  const { user } = await ctx(input.organizationId, input.branchId, { resource: DASH_CARD.USINE_CLIENTS, action: 'UPDATE' });
  const dueAt = new Date(input.dueAt);
  dueAt.setHours(0, 0, 0, 0);
  if (Number.isNaN(dueAt.getTime()) || dueAt < startOfToday()) {
    throw new Error("L’échéance doit être aujourd’hui ou plus tard.");
  }

  const rate = await getActiveExchangeRate(input.branchId);
  const marketerDisplayName =
    user.name?.trim() || user.email || "Marketeur";

  const credit = await prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        status: string;
        customerId: string;
        deliveryAddress: string | null;
        deliveryCity: string | null;
        requestedDeliveryAt: Date | null;
        customerName: string;
        customerPhone: string | null;
      }>
    >`
      SELECT r.id, r.status, r."customerId", r."deliveryAddress", r."deliveryCity",
             r."requestedDeliveryAt",
             c.name AS "customerName", c.phone AS "customerPhone"
      FROM "FactoryOrderRequest" r
      JOIN "FactoryCustomer" c ON c.id = r."customerId"
      WHERE r.id = ${input.requestId} AND r."branchId" = ${input.branchId}
      FOR UPDATE OF r
    `;
    const req = locked[0];
    if (!req) throw new Error("Demande introuvable.");
    if (req.status !== "PENDING") throw new Error("Demande déjà traitée.");
    if (!req.customerPhone?.trim()) {
      throw new Error("Téléphone client obligatoire pour créer le crédit.");
    }

    const requestLines = await tx.factoryOrderRequestLine.findMany({
      where: { requestId: req.id },
    });
    if (!requestLines.length) throw new Error("Demande sans lignes.");

    const requestQtyByProduct = new Map<string, number>();
    const requestPriceByProduct = new Map<string, number | null>();
    const requestNameByProduct = new Map<string, string>();
    for (const l of requestLines) {
      requestQtyByProduct.set(
        l.shopProductId,
        (requestQtyByProduct.get(l.shopProductId) ?? 0) + l.qty,
      );
      requestPriceByProduct.set(l.shopProductId, l.unitPriceUsd);
      requestNameByProduct.set(l.shopProductId, l.nameSnapshot);
    }

    const freeMap = await factoryFloatFreeByProduct(tx, input.branchId);
    const sourceLines = input.lines?.length
      ? input.lines
      : requestLines.map((l) => ({
          shopProductId: l.shopProductId,
          qty: l.qty,
          unitPriceUsd: l.unitPriceUsd ?? undefined,
        }));

    const creditLines: {
      shopProductId: string;
      nameSnapshot: string;
      qty: number;
      unitPriceUsd: number;
      lineTotalUsd: number;
    }[] = [];
    const seen = new Set<string>();

    for (const l of sourceLines) {
      if (seen.has(l.shopProductId)) {
        throw new Error("Ligne produit en double dans l’approbation.");
      }
      seen.add(l.shopProductId);

      const maxQty = requestQtyByProduct.get(l.shopProductId);
      if (maxQty == null) {
        throw new Error(
          "Produit hors demande — seuls les articles demandés peuvent être livrés.",
        );
      }
      const requested = Math.floor(Number(l.qty) || 0);
      if (requested <= 0) continue;
      if (requested > maxQty) {
        throw new Error(
          `Quantité supérieure à la demande pour « ${requestNameByProduct.get(l.shopProductId)} » (max ${maxQty}).`,
        );
      }
      const free = freeMap.get(l.shopProductId)?.free ?? 0;
      if (free <= 0) continue;
      const qty = Math.min(requested, free);
      if (qty <= 0) continue;

      const catalogPrice = freeMap.get(l.shopProductId)?.price;
      const unitPriceUsd = roundMoney(
        typeof l.unitPriceUsd === "number" &&
          Number.isFinite(l.unitPriceUsd) &&
          l.unitPriceUsd > 0
          ? l.unitPriceUsd
          : (requestPriceByProduct.get(l.shopProductId) ??
              catalogPrice ??
              0),
      );
      if (!(unitPriceUsd > 0)) {
        throw new Error(
          `Prix invalide pour « ${requestNameByProduct.get(l.shopProductId)} ».`,
        );
      }
      creditLines.push({
        shopProductId: l.shopProductId,
        nameSnapshot:
          requestNameByProduct.get(l.shopProductId) ??
          freeMap.get(l.shopProductId)?.name ??
          "Produit",
        qty,
        unitPriceUsd,
        lineTotalUsd: roundMoney(unitPriceUsd * qty),
      });
    }

    if (!creditLines.length) {
      throw new Error(
        "Aucune quantité livrable sur le float. Réassortissez ou baissez les quantités.",
      );
    }

    await consumeShopServiceFloatInTx(
      tx,
      input.branchId,
      creditLines.map((l) => ({
        productId: l.shopProductId,
        quantity: l.qty,
        name: l.nameSnapshot,
      })),
    );

    const totalUsd = roundMoney(
      creditLines.reduce((s, l) => s + l.lineTotalUsd, 0),
    );
    let number = await nextNumber(input.branchId, "CR", tx);
    let created:
      | {
          id: string;
          number: string;
          lines: { qty: number; nameSnapshot: string }[];
        }
      | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        created = await tx.factoryCredit.create({
          data: {
            branchId: input.branchId,
            number,
            customerId: req.customerId,
            marketerUserId: user.id,
            marketerDisplayName,
            status: "OPEN",
            dueAt,
            originalDueAt: dueAt,
            totalUsd,
            paidUsd: 0,
            fxUsdToCdf: rate?.rate ?? null,
            documentIssuedAt: new Date(),
            deliveryAddress: req.deliveryAddress,
            deliveryCity: req.deliveryCity,
            requestedDeliveryAt: req.requestedDeliveryAt,
            lines: { create: creditLines },
          },
          include: { lines: true },
        });
        break;
      } catch (err) {
        if (!isUniqueConflict(err) || attempt === 5) throw err;
        number = await nextNumber(input.branchId, "CR", tx);
      }
    }
    if (!created) throw new Error("Impossible de créer le crédit.");

    const claimed = await tx.factoryOrderRequest.updateMany({
      where: {
        id: req.id,
        branchId: input.branchId,
        status: "PENDING",
      },
      data: {
        status: "APPROVED",
        reviewedByUserId: user.id,
        reviewedAt: new Date(),
        creditId: created.id,
      },
    });
    if (claimed.count !== 1) {
      throw new Error("Demande déjà traitée (conflit concurrent).");
    }

    const deliveredByProduct = new Map<string, number>();
    for (const l of creditLines) {
      deliveredByProduct.set(
        l.shopProductId,
        (deliveredByProduct.get(l.shopProductId) ?? 0) + l.qty,
      );
    }
    const residualLines: {
      shopProductId: string;
      nameSnapshot: string;
      qty: number;
      unitPriceUsd: number | null;
    }[] = [];
    for (const [shopProductId, maxQty] of requestQtyByProduct) {
      const delivered = deliveredByProduct.get(shopProductId) ?? 0;
      const left = maxQty - delivered;
      if (left <= 0) continue;
      residualLines.push({
        shopProductId,
        nameSnapshot: requestNameByProduct.get(shopProductId) ?? "Produit",
        qty: left,
        unitPriceUsd: requestPriceByProduct.get(shopProductId) ?? null,
      });
    }

    let residualRequestId: string | null = null;
    if (residualLines.length) {
      const residual = await tx.factoryOrderRequest.create({
        data: {
          branchId: input.branchId,
          customerId: req.customerId,
          status: "PENDING",
          requestedDeliveryAt: req.requestedDeliveryAt,
          deliveryAddress: req.deliveryAddress,
          deliveryCity: req.deliveryCity,
          notes: `Reliquat auto après livraison partielle (demande ${req.id.slice(0, 8)} · crédit ${created.number}).`,
          lines: { create: residualLines },
        },
        select: { id: true },
      });
      residualRequestId = residual.id;
    }

    return {
      ...created,
      customerName: req.customerName,
      customerPhone: req.customerPhone,
      requestId: req.id,
      residualRequestId,
      residualQtyLabel: residualLines
        .map((l) => `${l.qty}× ${l.nameSnapshot}`)
        .join(", "),
    };
  });

  const { notifyFactoryOrderRequestApproved } = await import(
    "@/lib/factory/notifications"
  );
  void notifyFactoryOrderRequestApproved({
    branchId: input.branchId,
    requestId: credit.requestId,
    customerName: credit.customerName,
    phone: credit.customerPhone,
    creditNumber: credit.number,
    qtyLabel: credit.lines
      .map((l) => `${l.qty}× ${l.nameSnapshot}`)
      .join(", "),
  });
  if (credit.residualRequestId && credit.residualQtyLabel) {
    const { notifyFactoryOrderRequestCreated } = await import(
      "@/lib/factory/notifications"
    );
    void notifyFactoryOrderRequestCreated({
      branchId: input.branchId,
      requestId: credit.residualRequestId,
      customerName: credit.customerName,
      phone: credit.customerPhone,
      qtyLabel: credit.residualQtyLabel,
      href: usineRoutes.demandes(input.organizationId, input.branchId),
    });
  }
  revalidateFactory(input.organizationId, input.branchId);
  return credit;
}
