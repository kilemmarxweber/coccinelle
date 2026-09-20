"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { branchBasePath, usineRoutes } from "@/lib/branch/paths";
import { isUsine } from "@/lib/branch/usine";
import prisma from "@/lib/prisma";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import { consumeShopServiceFloatInTx } from "@/lib/hotel/service-stock";
import { remainingFloat } from "@/lib/hotel/service-stock-print";
import {
  notifyFactoryCreditCreated,
  notifyFactoryCreditExtension,
  notifyFactoryCreditPayment,
  notifyFactoryReservation,
} from "@/lib/factory/notifications";

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

async function ctx(organizationId: string, branchId: string) {
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

async function nextNumber(branchId: string, prefix: "CR" | "LOT") {
  if (prefix === "CR") {
    const n = await prisma.factoryCredit.count({ where: { branchId } });
    return `CR-${String(n + 1).padStart(5, "0")}`;
  }
  const n = await prisma.factoryBatch.count({ where: { branchId } });
  return `LOT-${String(n + 1).padStart(5, "0")}`;
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
  await ctx(organizationId, branchId);
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
  await ctx(input.organizationId, input.branchId);
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
  await ctx(organizationId, branchId);
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
  await ctx(organizationId, branchId);
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
  const { branch } = await ctx(input.organizationId, input.branchId);
  const name = input.name.trim();
  if (name.length < 2) throw new Error("Nom du client requis.");

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
    phone: input.phone?.trim() || null,
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
    await ctx(input.organizationId, input.branchId);
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
    const { ORG_ROLE } = await import("@/lib/permissions");
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
      const member = await prisma.member.findFirst({
        where: {
          userId: existingUser.id,
          organizationId: input.organizationId,
        },
        select: { id: true },
      });
      if (!member) {
        await auth.api.addMember({
          body: {
            userId: existingUser.id,
            role: ORG_ROLE.USER as "owner",
            organizationId: input.organizationId,
          },
          headers: h,
        });
      }
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

      await auth.api.addMember({
        body: {
          userId: user.id,
          role: ORG_ROLE.USER as "owner",
          organizationId: input.organizationId,
        },
        headers: h,
      });

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
  await ctx(organizationId, branchId);
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
  await ctx(organizationId, branchId);
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
  await ctx(organizationId, branchId);
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
  await ctx(input.organizationId, input.branchId);
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
  await ctx(organizationId, branchId);
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
  const { user } = await ctx(input.organizationId, input.branchId);
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
  for (const line of recipe.lines) {
        const need = Math.round(line.qtyPerBatch * multiplier);
    if (line.consumable.stockQty < need) {
      throw new Error(
        `Stock insuffisant : ${line.consumable.name} (besoin ${need}, dispo ${line.consumable.stockQty}). Passez un bon de commande.`,
      );
    }
  }
  const number = await nextNumber(input.branchId, "LOT");
  const batch = await prisma.$transaction(async (tx) => {
    for (const line of recipe.lines) {
        const need = Math.round(line.qtyPerBatch * multiplier);
      await tx.shopProduct.update({
        where: { id: line.consumableProductId },
        data: { stockQty: { decrement: need } },
      });
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
    await tx.shopProduct.update({
      where: { id: recipe.shopProductId },
      data: { stockQty: { increment: outputQty } },
    });
    await tx.shopStockMovement.create({
      data: {
        branchId: input.branchId,
        productId: recipe.shopProductId,
        kind: "ENTREE",
        quantity: outputQty,
        note: `Lot ${number}`,
      },
    });
    return tx.factoryBatch.create({
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
  });
  revalidateFactory(input.organizationId, input.branchId);
  return batch;
}

export async function listFactoryCreditsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
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
  await ctx(organizationId, branchId);
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
  await ctx(organizationId, branchId);
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
  const { user } = await ctx(input.organizationId, input.branchId);
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
    const qty = Math.max(1, Math.floor(l.qty));
    const unitPriceUsd = roundMoney(l.unitPriceUsd);
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
  const number = await nextNumber(input.branchId, "CR");
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
    return tx.factoryCredit.create({
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
  await ctx(input.organizationId, input.branchId);
  const row = await prisma.factoryCredit.update({
    where: { id: input.creditId },
    data: { signedAt: new Date() },
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
  const { user } = await ctx(input.organizationId, input.branchId);
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
  const { user } = await ctx(input.organizationId, input.branchId);
  const amountUsd = roundMoney(input.amountUsd);
  if (amountUsd <= 0) throw new Error("Montant invalide.");
  const credit = await prisma.factoryCredit.findFirst({
    where: { id: input.creditId, branchId: input.branchId },
    include: { customer: true, payments: true },
  });
  if (!credit) throw new Error("Crédit introuvable.");
  if (credit.status === "SETTLED" || credit.status === "CANCELLED") {
    throw new Error("Crédit déjà clôturé.");
  }
  const remaining = roundMoney(credit.totalUsd - credit.paidUsd);
  if (amountUsd - remaining > 0.01) {
    throw new Error(`Montant supérieur au restant (${remaining} USD).`);
  }
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
  const remainingAfter = roundMoney(remaining - amountUsd);
  const kind =
    remainingAfter <= 0.01
      ? "SOLDE"
      : credit.paidUsd <= 0.01
        ? "ACOMPTE"
        : "COMPLEMENT";
  const paidUsd = roundMoney(credit.paidUsd + amountUsd);
  const status = paidUsd + 0.01 >= credit.totalUsd ? "SETTLED" : "PARTIAL";
  const rate = await getActiveExchangeRate(input.branchId);
  const count = await prisma.payment.count({ where: { branchId: input.branchId } });
  const receiptNumber = `RC-${String(count + 1).padStart(5, "0")}`;
  await prisma.$transaction([
    prisma.payment.create({
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
    }),
    prisma.factoryCredit.update({
      where: { id: credit.id },
      data: { paidUsd, status },
    }),
  ]);
  void notifyFactoryCreditPayment({
    branchId: input.branchId,
    creditId: credit.id,
    number: credit.number,
    customerName: credit.customer.name,
    phone: credit.customer.phone,
    kind,
    amountUsd,
    remainingUsd: Math.max(0, remainingAfter),
    dueAt: credit.dueAt,
    settled: status === "SETTLED",
  });
  revalidateFactory(input.organizationId, input.branchId);
  return { kind, status, remainingUsd: Math.max(0, remainingAfter) };
}

export async function listFactoryReservationsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
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
  const { user } = await ctx(input.organizationId, input.branchId);
  if (!input.lines.length) throw new Error("Ajoutez au moins un produit.");
  const customer = await prisma.factoryCustomer.findFirst({
    where: { id: input.customerId, branchId: input.branchId },
  });
  if (!customer) throw new Error("Client introuvable.");
  if (!customer.active) throw new Error("Client inactif.");
  const float = await listFactoryFloatProductsAction(
    input.organizationId,
    input.branchId,
  );
  const free = new Map(float.map((p) => [p.id, p.free]));
  for (const line of input.lines) {
    const qty = Math.max(1, Math.floor(line.qty));
    const available = free.get(line.shopProductId) ?? 0;
    if (qty > available) {
      throw new Error("Quantité supérieure au stock auxiliaire libre.");
    }
  }
  const holdUntil = new Date();
  holdUntil.setDate(holdUntil.getDate() + Math.max(1, input.holdDays ?? 7));
  const reservation = await prisma.factoryReservation.create({
    data: {
      branchId: input.branchId,
      customerId: input.customerId,
      marketerUserId: user.id,
      marketerDisplayName: user.name?.trim() || user.email || "Marketeur",
      holdUntil,
      creditId: input.creditId || null,
      lines: {
        create: input.lines.map((l) => ({
          shopProductId: l.shopProductId,
          qty: Math.max(1, Math.floor(l.qty)),
        })),
      },
    },
    include: { lines: { include: { shopProduct: true } } },
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
  await ctx(input.organizationId, input.branchId);
  const row = await prisma.factoryReservation.findFirst({
    where: { id: input.reservationId, branchId: input.branchId },
  });
  if (!row || row.status !== "HOLD") {
    throw new Error("Réservation inactive.");
  }
  await prisma.factoryReservation.update({
    where: { id: row.id },
    data: { status: "PICKED" },
  });
  revalidateFactory(input.organizationId, input.branchId);
}

export async function cancelFactoryReservationAction(input: {
  organizationId: string;
  branchId: string;
  reservationId: string;
}) {
  await ctx(input.organizationId, input.branchId);
  await prisma.factoryReservation.update({
    where: { id: input.reservationId },
    data: { status: "CANCELLED" },
  });
  revalidateFactory(input.organizationId, input.branchId);
}

export async function factoryCreditsOpenSummaryAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
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
  await ctx(organizationId, branchId);
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
  const { user } = await ctx(input.organizationId, input.branchId);
  const reason = input.reason.trim();
  if (reason.length < 3) throw new Error("Motif de refus requis.");
  const req = await prisma.factoryOrderRequest.findFirst({
    where: { id: input.requestId, branchId: input.branchId },
    include: { customer: true, lines: true },
  });
  if (!req) throw new Error("Demande introuvable.");
  if (req.status !== "PENDING") throw new Error("Demande déjà traitée.");

  await prisma.factoryOrderRequest.update({
    where: { id: req.id },
    data: {
      status: "REJECTED",
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
      rejectReason: reason,
    },
  });

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
  const { user } = await ctx(input.organizationId, input.branchId);
  const req = await prisma.factoryOrderRequest.findFirst({
    where: { id: input.requestId, branchId: input.branchId },
    include: { customer: true, lines: true },
  });
  if (!req) throw new Error("Demande introuvable.");
  if (req.status !== "PENDING") throw new Error("Demande déjà traitée.");

  const floatProducts = await listFactoryFloatProductsAction(
    input.organizationId,
    input.branchId,
  );
  const freeById = new Map(floatProducts.map((p) => [p.id, p.free]));
  const priceById = new Map(floatProducts.map((p) => [p.id, p.price]));

  const products = await prisma.shopProduct.findMany({
    where: {
      branchId: input.branchId,
      productKind: "FINISHED",
      id: {
        in: (input.lines?.length ? input.lines : req.lines).map(
          (l) => l.shopProductId,
        ),
      },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  const sourceLines = input.lines?.length
    ? input.lines
    : req.lines.map((l) => ({
        shopProductId: l.shopProductId,
        qty: l.qty,
        unitPriceUsd: l.unitPriceUsd ?? undefined,
      }));

  const creditLines: {
    shopProductId: string;
    qty: number;
    unitPriceUsd: number;
  }[] = [];

  for (const l of sourceLines) {
    const p = byId.get(l.shopProductId);
    if (!p) throw new Error("Produit fini introuvable.");
    const requested = Math.max(0, Math.floor(Number(l.qty) || 0));
    if (requested <= 0) continue;
    const free = freeById.get(p.id) ?? 0;
    if (free <= 0) continue;
    const qty = Math.min(requested, free);
    if (qty <= 0) continue;
    const unitPriceUsd = roundMoney(
      typeof l.unitPriceUsd === "number" && Number.isFinite(l.unitPriceUsd)
        ? l.unitPriceUsd
        : (priceById.get(p.id) ?? p.price),
    );
    creditLines.push({ shopProductId: p.id, qty, unitPriceUsd });
  }

  if (!creditLines.length) {
    throw new Error(
      "Aucune quantité livrable sur le float. Réassortissez ou baissez les quantités.",
    );
  }

  const credit = await createFactoryCreditAction({
    organizationId: input.organizationId,
    branchId: input.branchId,
    customerId: req.customerId,
    dueAt: input.dueAt,
    lines: creditLines,
    deliveryAddress: req.deliveryAddress ?? undefined,
    deliveryCity: req.deliveryCity ?? undefined,
    requestedDeliveryAt: req.requestedDeliveryAt?.toISOString() ?? null,
  });

  await prisma.factoryOrderRequest.update({
    where: { id: req.id },
    data: {
      status: "APPROVED",
      reviewedByUserId: user.id,
      reviewedAt: new Date(),
      creditId: credit.id,
    },
  });

  const { notifyFactoryOrderRequestApproved } = await import(
    "@/lib/factory/notifications"
  );
  void notifyFactoryOrderRequestApproved({
    branchId: input.branchId,
    requestId: req.id,
    customerName: req.customer.name,
    phone: req.customer.phone,
    creditNumber: credit.number,
    qtyLabel: credit.lines
      .map((l) => `${l.qty}× ${l.nameSnapshot}`)
      .join(", "),
  });
  revalidateFactory(input.organizationId, input.branchId);
  return credit;
}
