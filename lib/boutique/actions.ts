"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { branchBasePath } from "@/lib/branch/paths";
import {
  generateInternalBarcode,
  normalizeBarcode,
  parseBarcodeInput,
} from "@/lib/hotel/barcode";
import prisma from "@/lib/prisma";
import { consumeShopServiceFloatInTx } from "@/lib/hotel/service-stock";
import {
  effectivePrice,
  generateAnonymousCode,
  isPromoCurrentlyActive,
} from "@/lib/boutique/pricing";
import {
  getActiveExchangeRate,
  getOpenCashSession,
} from "@/lib/cash/actions";

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
  if (branch.type !== "BOUTIQUE") {
    throw new Error("Module boutique requis.");
  }
  return { user: session.user, branch };
}

function revalidateBoutique(organizationId: string, branchId: string) {
  const base = branchBasePath(organizationId, branchId);
  revalidatePath(base);
  revalidatePath(`${base}/boutique/pos`);
  revalidatePath(`${base}/boutique/produits`);
  revalidatePath(`${base}/boutique/stock`);
  revalidatePath(`${base}/boutique/service-stock`);
  revalidatePath(`${base}/rapports/tableau-bord`);
}

async function nextTicketNumber(branchId: string) {
  const count = await prisma.shopSale.count({ where: { branchId } });
  return `TK-${String(count + 1).padStart(5, "0")}`;
}

async function nextReceiptNumber(branchId: string) {
  const count = await prisma.payment.count({ where: { branchId } });
  return `RC-${String(count + 1).padStart(5, "0")}`;
}

export type ShopProductDto = {
  id: string;
  branchId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  sku: string;
  kind: "ARTICLE" | "PLAT";
  price: number;
  promoPrice: number | null;
  promoActive: boolean;
  promoLabel: string | null;
  promoStartsAt: Date | null;
  promoEndsAt: Date | null;
  stockQty: number;
  /** Quantité déjà réservée par des tickets en attente. */
  heldQty: number;
  /** Stock affiché POS = stock − holds */
  availableQty: number;
  barcode: string | null;
  imageUrl: string | null;
  active: boolean;
  effectivePrice: number;
  promoLive: boolean;
};

function remainingFloat(line: {
  qtyAttributed: number;
  qtySold: number;
  qtyLoss: number;
}) {
  return Math.max(0, line.qtyAttributed - line.qtySold - line.qtyLoss);
}

async function shopFloatRemainingByProduct(branchId: string) {
  const session = await prisma.serviceStockSession.findFirst({
    where: {
      branchId,
      status: "OPEN",
      openingConfirmedAt: { not: null },
    },
    include: { lines: true },
  });
  if (!session) {
    throw new Error(
      "Ouvrez et confirmez le service stock avant de vendre au point de vente.",
    );
  }
  const map = new Map<string, number>();
  for (const line of session.lines) {
    if (!line.shopProductId) continue;
    map.set(line.shopProductId, remainingFloat(line));
  }
  return map;
}

async function heldQtyByProduct(branchId: string): Promise<Map<string, number>> {
  const holds = await prisma.shopSale.findMany({
    where: { branchId, status: "EN_ATTENTE" },
    include: { items: true },
  });
  const map = new Map<string, number>();
  for (const sale of holds) {
    for (const item of sale.items) {
      if (!item.productId) continue;
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.quantity);
    }
  }
  return map;
}

function toDto(
  p: {
    id: string;
    branchId: string;
    categoryId: string;
    name: string;
    sku: string;
    kind: "ARTICLE" | "PLAT";
    price: number;
    promoPrice: number | null;
    promoActive: boolean;
    promoLabel: string | null;
    promoStartsAt: Date | null;
    promoEndsAt: Date | null;
    stockQty: number;
    barcode: string | null;
    imageUrl: string | null;
    active: boolean;
    category: { name: string };
  },
  held: Map<string, number>,
): ShopProductDto {
  const promoLive = isPromoCurrentlyActive(p);
  const heldQty = held.get(p.id) ?? 0;
  return {
    id: p.id,
    branchId: p.branchId,
    categoryId: p.categoryId,
    categoryName: p.category.name,
    name: p.name,
    sku: p.sku,
    kind: p.kind,
    price: p.price,
    promoPrice: p.promoPrice,
    promoActive: p.promoActive,
    promoLabel: p.promoLabel,
    promoStartsAt: p.promoStartsAt,
    promoEndsAt: p.promoEndsAt,
    stockQty: p.stockQty,
    heldQty,
    availableQty: Math.max(0, p.stockQty - heldQty),
    barcode: p.barcode,
    imageUrl: p.imageUrl,
    active: p.active,
    effectivePrice: effectivePrice(p),
    promoLive,
  };
}

export async function listShopCategoriesAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.shopCategory.findMany({
    where: { branchId },
    orderBy: { name: "asc" },
  });
}

export async function listShopProductsAction(
  organizationId: string,
  branchId: string,
  opts?: { activeOnly?: boolean },
) {
  await ctx(organizationId, branchId);
  const held = await heldQtyByProduct(branchId);
  const rows = await prisma.shopProduct.findMany({
    where: {
      branchId,
      ...(opts?.activeOnly ? { active: true } : {}),
    },
    include: { category: true },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
  });
  return rows.map((p) => toDto(p, held));
}

export async function createShopCategoryAction(input: {
  organizationId: string;
  branchId: string;
  name: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const name = input.name.trim();
  if (!name) throw new Error("Nom de catégorie requis.");
  const cat = await prisma.shopCategory.create({
    data: { branchId: input.branchId, name },
  });
  revalidateBoutique(input.organizationId, input.branchId);
  return cat;
}

export async function createShopProductAction(input: {
  organizationId: string;
  branchId: string;
  categoryId: string;
  name: string;
  sku: string;
  kind?: "ARTICLE" | "PLAT";
  price: number;
  stockQty?: number;
  barcode?: string | null;
  imageUrl?: string | null;
  promoActive?: boolean;
  promoPrice?: number | null;
  promoLabel?: string | null;
}) {
  await ctx(input.organizationId, input.branchId);
  const name = input.name.trim();
  const sku = input.sku.trim().toUpperCase();
  if (!name) throw new Error("Nom requis.");
  if (!sku) throw new Error("SKU requis.");
  if (!(input.price >= 0)) throw new Error("Prix invalide.");

  const category = await prisma.shopCategory.findFirst({
    where: { id: input.categoryId, branchId: input.branchId },
  });
  if (!category) throw new Error("Catégorie introuvable.");

  const barcode = input.barcode?.trim()
    ? parseBarcodeInput(input.barcode)
    : null;

  const promoActive = Boolean(input.promoActive);
  const promoPrice = promoActive ? (input.promoPrice ?? null) : input.promoPrice ?? null;
  if (promoActive) {
    if (promoPrice == null || !(promoPrice >= 0) || !(promoPrice < input.price)) {
      throw new Error("Prix promo invalide (doit être < prix catalogue).");
    }
  }

  try {
    const product = await prisma.shopProduct.create({
      data: {
        branchId: input.branchId,
        categoryId: input.categoryId,
        name,
        sku,
        kind: input.kind ?? "ARTICLE",
        price: input.price,
        stockQty: input.stockQty ?? 0,
        barcode,
        imageUrl: input.imageUrl ?? null,
        promoActive,
        promoPrice,
        promoLabel: input.promoLabel?.trim() || null,
      },
      include: { category: true },
    });
    revalidateBoutique(input.organizationId, input.branchId);
    return toDto(product, new Map());
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique") || msg.includes("unique")) {
      throw new Error("SKU ou code-barres déjà utilisé.");
    }
    throw e;
  }
}

export async function updateShopProductAction(input: {
  organizationId: string;
  branchId: string;
  productId: string;
  categoryId?: string;
  name?: string;
  sku?: string;
  kind?: "ARTICLE" | "PLAT";
  price?: number;
  stockQty?: number;
  barcode?: string | null;
  imageUrl?: string | null;
  active?: boolean;
  promoActive?: boolean;
  promoPrice?: number | null;
  promoLabel?: string | null;
}) {
  await ctx(input.organizationId, input.branchId);
  const existing = await prisma.shopProduct.findFirst({
    where: { id: input.productId, branchId: input.branchId },
  });
  if (!existing) throw new Error("Produit introuvable.");

  if (input.categoryId) {
    const category = await prisma.shopCategory.findFirst({
      where: { id: input.categoryId, branchId: input.branchId },
    });
    if (!category) throw new Error("Catégorie introuvable.");
  }

  const price = input.price ?? existing.price;
  const promoActive =
    input.promoActive !== undefined ? input.promoActive : existing.promoActive;
  const promoPrice =
    input.promoPrice !== undefined ? input.promoPrice : existing.promoPrice;
  if (promoActive) {
    if (promoPrice == null || !(promoPrice >= 0) || !(promoPrice < price)) {
      throw new Error("Prix promo invalide (doit être < prix catalogue).");
    }
  }

  let barcode: string | null | undefined = undefined;
  if (input.barcode !== undefined) {
    barcode = input.barcode?.trim()
      ? parseBarcodeInput(input.barcode)
      : null;
  }

  try {
    const product = await prisma.shopProduct.update({
      where: { id: input.productId },
      data: {
        categoryId: input.categoryId,
        name: input.name?.trim(),
        sku: input.sku?.trim().toUpperCase(),
        kind: input.kind,
        price: input.price,
        stockQty: input.stockQty,
        barcode,
        imageUrl: input.imageUrl === undefined ? undefined : input.imageUrl,
        active: input.active,
        promoActive,
        promoPrice,
        promoLabel:
          input.promoLabel === undefined
            ? undefined
            : input.promoLabel?.trim() || null,
      },
      include: { category: true },
    });
    revalidateBoutique(input.organizationId, input.branchId);
    const held = await heldQtyByProduct(input.branchId);
    return toDto(product, held);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Unique") || msg.includes("unique")) {
      throw new Error("SKU ou code-barres déjà utilisé.");
    }
    throw e;
  }
}

export async function generateShopBarcodeAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return generateInternalBarcode(branchId);
}

export async function listHeldSalesAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.shopSale.findMany({
    where: { branchId, status: "EN_ATTENTE" },
    include: { items: true },
    orderBy: { heldAt: "desc" },
  });
}

export async function holdShopSaleAction(input: {
  organizationId: string;
  branchId: string;
  holdLabel?: string;
  items: { productId: string; quantity: number }[];
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  if (!input.items.length) throw new Error("Panier vide.");

  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.shopProduct.findMany({
    where: { branchId: input.branchId, id: { in: productIds }, active: true },
  });
  if (products.length !== new Set(productIds).size) {
    throw new Error("Produit introuvable ou inactif.");
  }
  const byId = new Map(products.map((p) => [p.id, p]));
  const held = await heldQtyByProduct(input.branchId);
  const floatById = await shopFloatRemainingByProduct(input.branchId);

  let total = 0;
  const lines = input.items.map((line) => {
    const p = byId.get(line.productId)!;
    if (!(line.quantity > 0)) throw new Error("Quantité invalide.");
    const available =
      (floatById.get(p.id) ?? 0) - (held.get(p.id) ?? 0);
    if (line.quantity > available) {
      throw new Error(
        `Float insuffisant pour « ${p.name} » (dispo ${Math.max(0, available)}).`,
      );
    }
    const unit = effectivePrice(p);
    const promoLive = isPromoCurrentlyActive(p);
    total += unit * line.quantity;
    return {
      productId: p.id,
      name: p.name,
      kind: p.kind,
      quantity: line.quantity,
      unitPrice: unit,
      catalogPrice: p.price,
      wasPromo: promoLive,
    };
  });

  const ticketNumber = await nextTicketNumber(input.branchId);
  const label =
    input.holdLabel?.trim() ||
    `Attente ${new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;

  const sale = await prisma.shopSale.create({
    data: {
      branchId: input.branchId,
      status: "EN_ATTENTE",
      ticketNumber,
      holdLabel: label,
      totalAmount: total,
      cashierUserId: user.id,
      heldAt: new Date(),
      items: { create: lines },
    },
    include: { items: true },
  });

  revalidateBoutique(input.organizationId, input.branchId);
  return sale;
}

export async function resumeHeldSaleAction(input: {
  organizationId: string;
  branchId: string;
  saleId: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const sale = await prisma.shopSale.findFirst({
    where: {
      id: input.saleId,
      branchId: input.branchId,
      status: "EN_ATTENTE",
    },
    include: { items: true },
  });
  if (!sale) throw new Error("Ticket en attente introuvable.");
  return sale;
}

export async function cancelHeldSaleAction(input: {
  organizationId: string;
  branchId: string;
  saleId: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const sale = await prisma.shopSale.findFirst({
    where: {
      id: input.saleId,
      branchId: input.branchId,
      status: "EN_ATTENTE",
    },
  });
  if (!sale) throw new Error("Ticket en attente introuvable.");
  await prisma.shopSale.update({
    where: { id: sale.id },
    data: { status: "ANNULEE" },
  });
  revalidateBoutique(input.organizationId, input.branchId);
}

export async function checkoutShopSaleAction(input: {
  organizationId: string;
  branchId: string;
  /** Reprendre un hold existant (sinon nouvelle vente). */
  saleId?: string;
  items?: { productId: string; quantity: number }[];
  method: "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK";
  clientLabel?: string;
  clientPhone?: string;
  anonymous?: boolean;
  amountForeign?: number;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const cashSession = await getOpenCashSession(input.branchId, user.id);
  if (!cashSession) throw new Error("Ouvrez une session de caisse d’abord.");

  const isAnonymous =
    input.anonymous !== false &&
    !input.clientLabel?.trim() &&
    !input.clientPhone?.trim();
  const clientLabel = input.clientLabel?.trim() || null;
  const clientPhone = input.clientPhone?.trim() || null;
  const anonymousCode = isAnonymous ? generateAnonymousCode() : null;

  const rate = await getActiveExchangeRate(input.branchId);
  const receiptNumber = await nextReceiptNumber(input.branchId);

  const result = await prisma.$transaction(async (tx) => {
    let saleId = input.saleId;
    let lines: {
      productId: string | null;
      name: string;
      kind: "ARTICLE" | "PLAT";
      quantity: number;
      unitPrice: number;
      catalogPrice: number | null;
      wasPromo: boolean;
    }[] = [];

    if (saleId) {
      const held = await tx.shopSale.findFirst({
        where: {
          id: saleId,
          branchId: input.branchId,
          status: "EN_ATTENTE",
        },
        include: { items: true },
      });
      if (!held) throw new Error("Ticket en attente introuvable.");
      lines = held.items.map((i) => ({
        productId: i.productId,
        name: i.name,
        kind: i.kind,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        catalogPrice: i.catalogPrice,
        wasPromo: i.wasPromo,
      }));
    } else {
      if (!input.items?.length) throw new Error("Panier vide.");
      const productIds = input.items.map((i) => i.productId);
      const products = await tx.shopProduct.findMany({
        where: {
          branchId: input.branchId,
          id: { in: productIds },
          active: true,
        },
      });
      if (products.length !== new Set(productIds).size) {
        throw new Error("Produit introuvable ou inactif.");
      }
      const byId = new Map(products.map((p) => [p.id, p]));

      lines = input.items.map((line) => {
        const p = byId.get(line.productId)!;
        if (!(line.quantity > 0)) throw new Error("Quantité invalide.");
        const unit = effectivePrice(p);
        const promoLive = isPromoCurrentlyActive(p);
        return {
          productId: p.id,
          name: p.name,
          kind: p.kind,
          quantity: line.quantity,
          unitPrice: unit,
          catalogPrice: p.price,
          wasPromo: promoLive,
        };
      });
    }

    const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
    if (!(total > 0)) throw new Error("Montant invalide.");

    await consumeShopServiceFloatInTx(
      tx,
      input.branchId,
      lines
        .filter((l): l is typeof l & { productId: string } => Boolean(l.productId))
        .map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          name: l.name,
        })),
      { excludeSaleId: saleId },
    );

    let sale;
    if (saleId) {
      sale = await tx.shopSale.update({
        where: { id: saleId },
        data: {
          status: "ENCAISSEE",
          cashSessionId: cashSession.id,
          totalAmount: total,
          isAnonymous,
          anonymousCode,
          clientLabel,
          clientPhone,
          cashierUserId: user.id,
          paidAt: new Date(),
        },
      });
    } else {
      const ticketNumber = await nextTicketNumber(input.branchId);
      sale = await tx.shopSale.create({
        data: {
          branchId: input.branchId,
          cashSessionId: cashSession.id,
          status: "ENCAISSEE",
          ticketNumber,
          totalAmount: total,
          isAnonymous,
          anonymousCode,
          clientLabel,
          clientPhone,
          cashierUserId: user.id,
          paidAt: new Date(),
          items: {
            create: lines.map((l) => ({
              productId: l.productId,
              name: l.name,
              kind: l.kind,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              catalogPrice: l.catalogPrice,
              wasPromo: l.wasPromo,
            })),
          },
        },
      });
    }

    const payment = await tx.payment.create({
      data: {
        branchId: input.branchId,
        cashSessionId: cashSession.id,
        shopSaleId: sale.id,
        receiptNumber,
        method: input.method,
        amountCdf: total,
        amountForeign: input.amountForeign ?? null,
        foreignCurrency: rate?.fromCurrency ?? "USD",
        exchangeRateUsed: rate?.rate ?? null,
        cashierUserId: user.id,
        note: isAnonymous
          ? `Client ${anonymousCode}`
          : clientLabel
            ? `Client ${clientLabel}`
            : null,
      },
    });

    return { sale, payment };
  });

  revalidateBoutique(input.organizationId, input.branchId);
  const { autoMarkPresentFromActivity } = await import("@/lib/payroll/service");
  await autoMarkPresentFromActivity({
    branchId: input.branchId,
    userId: user.id,
  });
  return result;
}

export async function adjustShopStockAction(input: {
  organizationId: string;
  branchId: string;
  productId: string;
  kind: "ENTREE" | "AJUSTEMENT";
  quantity: number;
  note?: string;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  if (!(input.quantity > 0)) throw new Error("Quantité invalide.");

  const product = await prisma.shopProduct.findFirst({
    where: { id: input.productId, branchId: input.branchId },
  });
  if (!product) throw new Error("Produit introuvable.");

  if (input.kind === "AJUSTEMENT") {
    // quantity = nouveau stock absolu
    const delta = input.quantity - product.stockQty;
    await prisma.$transaction([
      prisma.shopProduct.update({
        where: { id: product.id },
        data: { stockQty: input.quantity },
      }),
      prisma.shopStockMovement.create({
        data: {
          branchId: input.branchId,
          productId: product.id,
          kind: "AJUSTEMENT",
          quantity: Math.abs(delta) || input.quantity,
          note:
            input.note?.trim() ||
            `Ajustement → ${input.quantity} (Δ ${delta >= 0 ? "+" : ""}${delta})`,
          createdByUserId: user.id,
        },
      }),
    ]);
  } else {
    await prisma.$transaction([
      prisma.shopProduct.update({
        where: { id: product.id },
        data: { stockQty: { increment: input.quantity } },
      }),
      prisma.shopStockMovement.create({
        data: {
          branchId: input.branchId,
          productId: product.id,
          kind: "ENTREE",
          quantity: input.quantity,
          note: input.note?.trim() || "Réception stock",
          createdByUserId: user.id,
        },
      }),
    ]);
  }

  revalidateBoutique(input.organizationId, input.branchId);
}

export async function listShopStockMovementsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.shopStockMovement.findMany({
    where: { branchId },
    include: { product: { select: { name: true, sku: true } } },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
}

export async function getBoutiqueDashboardKpisAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  const [payments, tickets, held, lowStock] = await Promise.all([
    prisma.payment.findMany({
      where: {
        branchId,
        shopSaleId: { not: null },
        paidAt: { gte: start },
      },
      select: { amountCdf: true },
    }),
    prisma.shopSale.count({
      where: {
        branchId,
        status: "ENCAISSEE",
        paidAt: { gte: start },
      },
    }),
    prisma.shopSale.count({
      where: { branchId, status: "EN_ATTENTE" },
    }),
    prisma.shopProduct.count({
      where: { branchId, active: true, stockQty: { lte: 5 } },
    }),
  ]);

  const caJour = payments.reduce((s, p) => s + p.amountCdf, 0);
  return { caJour, ticketsJour: tickets, heldCount: held, lowStock };
}

/** Diffuse une promo produit active par WhatsApp (numéros branche). */
export async function notifyShopProductPromoWhatsAppAction(input: {
  organizationId: string;
  branchId: string;
  productId: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const product = await prisma.shopProduct.findFirst({
    where: { id: input.productId, branchId: input.branchId },
  });
  if (!product) throw new Error("Produit introuvable.");
  if (!product.promoActive || product.promoPrice == null) {
    throw new Error("Activez une promotion valide avant de notifier.");
  }

  const { broadcastBranchPromoWhatsApp } = await import(
    "@/lib/notifications/send-promo-broadcast"
  );
  const label = product.promoLabel?.trim() || "Promotion";
  return broadcastBranchPromoWhatsApp({
    branchId: input.branchId,
    title: label,
    productName: product.name,
    body: `${product.name} : ${product.promoPrice.toFixed(2)} $ (au lieu de ${product.price.toFixed(2)} $)`,
  });
}

export { normalizeBarcode, generateInternalBarcode };
