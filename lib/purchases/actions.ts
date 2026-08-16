"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  requireOrganizationPermission,
  type OrganizationPermissionMap,
} from "@/lib/auth/organization-permission";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { branchBasePath } from "@/lib/branch/paths";
import {
  getActiveExchangeRate,
  getOpenCashSession,
} from "@/lib/cash/actions";
import prisma from "@/lib/prisma";
import {
  defaultNeedsKitchen,
  HOTEL_MENU_CATEGORIES,
  isConsumableCategory,
} from "@/lib/hotel/menu-categories";
import {
  defaultExpenseCategory,
  expenseCashNote,
  expenseNumberPrefix,
  normalizeExpenseKind,
  type ExpenseKind,
} from "@/lib/expenses/kinds";

async function ctx(
  organizationId: string,
  branchId: string,
  permissions?: OrganizationPermissionMap,
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
  if (permissions) {
    await requireOrganizationPermission(organizationId, permissions);
  }
  return { user: session.user, branch };
}

function revalidatePurchases(organizationId: string, branchId: string) {
  const base = branchBasePath(organizationId, branchId);
  revalidatePath(base);
  revalidatePath(`${base}/bons-commande`);
  revalidatePath(`${base}/depenses`);
  revalidatePath(`${base}/caisse`);
  revalidatePath(`${base}/rapports/financier`);
  revalidatePath(`${base}/rapports/tableau-bord`);
  revalidatePath(`${base}/hotel/produits`);
  revalidatePath(`${base}/hotel/restauration`);
  revalidatePath(`${base}/hotel/livraison`);
  revalidatePath(`${base}/boutique/produits`);
  revalidatePath(`${base}/boutique/stock`);
}

async function nextReceiptNumber(branchId: string, tx?: typeof prisma) {
  const db = tx ?? prisma;
  const count = await db.payment.count({ where: { branchId } });
  return `RC-${String(count + 1).padStart(5, "0")}`;
}

async function nextPurchaseOrderNumber(branchId: string) {
  const count = await prisma.purchaseOrder.count({ where: { branchId } });
  return `BC-${String(count + 1).padStart(5, "0")}`;
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function branchHasProductCatalog(type: string) {
  return type === "BOUTIQUE" || type === "HOTEL" || type === "RESTAURANT";
}

function assertBranchProductCatalog(type: string) {
  if (!branchHasProductCatalog(type)) {
    throw new Error(
      "Ce type de branche n’a pas de catalogue produits. Un bon ne crée des produits que pour la boutique / hôtel / resto de cette branche.",
    );
  }
}

type PoLineInput = {
  name: string;
  quantity: number;
  unitPriceUsd: number;
  /** Total ligne déjà converti (préféré — évite float qté × PU en USD). */
  lineTotalUsd?: number;
  /** Catégorie produit (existante ou nouvelle). */
  category?: string | null;
  shopProductId?: string | null;
  menuItemId?: string | null;
  createProduct?: boolean;
};

function normalizeCategoryName(value: string | null | undefined) {
  const c = (value ?? "").trim();
  return c || "Divers";
}

/**
 * Les bons de commande alimentent le catalogue vendable (resto / vente rapide).
 * « Consommables » est réservé à Livraison — on le mappe vers Divers.
 */
function sellableHotelCategory(value: string | null | undefined) {
  const c = normalizeCategoryName(value);
  if (isConsumableCategory(c)) return "Divers";
  return c;
}

function normalizeLines(lines: PoLineInput[]) {
  const out = lines
    .map((l) => {
      const name = l.name.trim();
      const quantity = Math.max(0, Math.round(Number(l.quantity) || 0));
      const unitPriceUsd = Number(l.unitPriceUsd);
      const lineTotalUsd =
        l.lineTotalUsd != null && Number.isFinite(Number(l.lineTotalUsd))
          ? roundMoney(Number(l.lineTotalUsd))
          : roundMoney(quantity * unitPriceUsd);
      return {
        name,
        quantity,
        unitPriceUsd,
        lineTotalUsd,
        category: normalizeCategoryName(l.category),
        shopProductId: l.shopProductId || null,
        menuItemId: l.menuItemId || null,
        createProduct: Boolean(l.createProduct),
      };
    })
    .filter(
      (l) =>
        l.name &&
        l.quantity > 0 &&
        Number.isFinite(l.unitPriceUsd) &&
        l.unitPriceUsd >= 0,
    );
  if (out.length === 0) throw new Error("Ajoutez au moins une ligne produit.");
  const totalAmountUsd = roundMoney(
    out.reduce((s, l) => s + l.lineTotalUsd, 0),
  );
  return { lines: out, totalAmountUsd };
}

async function createCashMovement(input: {
  branchId: string;
  userId: string;
  amountUsd: number;
  note: string;
  purchaseOrderId?: string;
  expenseId?: string;
  method?: "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK";
}) {
  const cashSession = await getOpenCashSession(input.branchId, input.userId);
  if (!cashSession) {
    throw new Error("Ouvrez une session de caisse pour enregistrer la sortie.");
  }
  const rate = await getActiveExchangeRate(input.branchId);
  const rateVal = rate?.rate && rate.rate > 0 ? rate.rate : 1;
  const amountForeign = roundMoney(input.amountUsd);
  const amountCdf = roundMoney(amountForeign * rateVal);
  const receiptNumber = await nextReceiptNumber(input.branchId);
  return prisma.payment.create({
    data: {
      branchId: input.branchId,
      cashSessionId: cashSession.id,
      purchaseOrderId: input.purchaseOrderId ?? null,
      expenseId: input.expenseId ?? null,
      receiptNumber,
      method: input.method ?? "CASH",
      amountCdf,
      amountForeign,
      foreignCurrency: rate?.fromCurrency ?? "USD",
      exchangeRateUsed: rate?.rate ?? null,
      cashierUserId: input.userId,
      note: input.note,
    },
  });
}

export async function listCatalogProductsAction(
  organizationId: string,
  branchId: string,
) {
  const { branch } = await ctx(organizationId, branchId, { bons_commande: ["voir"] });
  if (branch.type === "BOUTIQUE") {
    const products = await prisma.shopProduct.findMany({
      where: { branchId, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        stockQty: true,
        category: { select: { name: true } },
      },
    });
    return products.map((p) => ({
      id: p.id,
      name: p.name,
      priceUsd: p.price,
      stockQty: p.stockQty,
      category: p.category.name,
      kind: "shop" as const,
    }));
  }
  if (branch.type === "HOTEL" || branch.type === "RESTAURANT") {
    const items = await prisma.hotelMenuItem.findMany({
      where: { branchId, active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        price: true,
        stockQty: true,
        category: true,
        isConsumable: true,
      },
    });
    return items.map((p) => ({
      id: p.id,
      name: p.name,
      priceUsd: p.price,
      stockQty: p.stockQty,
      category: p.category,
      kind: "menu" as const,
      isConsumable: p.isConsumable,
    }));
  }
  return [];
}

/** Catégories existantes pour le formulaire de bon de commande. */
export async function listProductCategoriesAction(
  organizationId: string,
  branchId: string,
) {
  const { branch } = await ctx(organizationId, branchId, { bons_commande: ["voir"] });
  if (branch.type === "BOUTIQUE") {
    const rows = await prisma.shopCategory.findMany({
      where: { branchId },
      orderBy: { name: "asc" },
      select: { name: true },
    });
    const names = rows.map((r) => r.name);
    if (!names.includes("Achats")) names.push("Achats");
    return names;
  }
  if (branch.type === "HOTEL" || branch.type === "RESTAURANT") {
    const used = await prisma.hotelMenuItem.findMany({
      where: { branchId },
      distinct: ["category"],
      select: { category: true },
      orderBy: { category: "asc" },
    });
    const set = new Set<string>([...HOTEL_MENU_CATEGORIES]);
    for (const u of used) {
      if (u.category.trim()) set.add(u.category.trim());
    }
    // Consommables = page Livraison uniquement (filtrés hors resto / vente rapide).
    return [...set]
      .filter((c) => !isConsumableCategory(c))
      .sort((a, b) => a.localeCompare(b, "fr"));
  }
  return ["Divers"];
}

export async function listPurchaseOrdersAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { bons_commande: ["voir"] });
  return prisma.purchaseOrder.findMany({
    where: { branchId },
    include: { items: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createPurchaseOrderAction(input: {
  organizationId: string;
  branchId: string;
  supplierName?: string | null;
  note?: string | null;
  lines: PoLineInput[];
}) {
  const { user } = await ctx(input.organizationId, input.branchId, { bons_commande: ["ajouter"] });
  const { lines, totalAmountUsd } = normalizeLines(input.lines);
  const number = await nextPurchaseOrderNumber(input.branchId);
  const po = await prisma.purchaseOrder.create({
    data: {
      branchId: input.branchId,
      number,
      status: "EN_ATTENTE",
      supplierName: input.supplierName?.trim() || null,
      note: input.note?.trim() || null,
      totalAmountUsd,
      createdByUserId: user.id,
      items: {
        create: lines.map((l) => ({
          name: l.name,
          category: l.category,
          quantity: l.quantity,
          unitPriceUsd: l.unitPriceUsd,
          lineTotalUsd: l.lineTotalUsd,
          shopProductId: l.shopProductId,
          menuItemId: l.menuItemId,
          createProduct:
            l.createProduct || (!l.shopProductId && !l.menuItemId),
        })),
      },
    },
    include: { items: true },
  });
  revalidatePurchases(input.organizationId, input.branchId);
  return po;
}

/** Sortie de caisse du montant du bon (avant ou à la validation). */
export async function releasePurchaseOrderFundsAction(input: {
  organizationId: string;
  branchId: string;
  purchaseOrderId: string;
  amountUsd?: number;
}) {
  const { user } = await ctx(input.organizationId, input.branchId, { bons_commande: ["modifier"] });
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: input.purchaseOrderId, branchId: input.branchId },
  });
  if (!po) throw new Error("Bon de commande introuvable.");
  if (po.status === "VALIDE" || po.status === "ANNULE") {
    throw new Error("Ce bon ne peut plus être modifié.");
  }
  const amount = roundMoney(
    input.amountUsd != null && Number.isFinite(input.amountUsd)
      ? Number(input.amountUsd)
      : po.totalAmountUsd,
  );
  if (!(amount > 0)) throw new Error("Montant de sortie invalide.");

  await createCashMovement({
    branchId: input.branchId,
    userId: user.id,
    amountUsd: -amount,
    note: `Sortie achat · ${po.number}`,
    purchaseOrderId: po.id,
  });

  const updated = await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: {
      fundsReleasedUsd: roundMoney(po.fundsReleasedUsd + amount),
      status: "FONDS_SORTIS",
    },
    include: { items: true },
  });
  revalidatePurchases(input.organizationId, input.branchId);
  return updated;
}

export async function validatePurchaseOrderAction(input: {
  organizationId: string;
  branchId: string;
  purchaseOrderId: string;
  lines: Array<{
    id: string;
    receivedQty: number;
    unitPriceUsd: number;
    lineTotalUsd?: number;
  }>;
}) {
  const { user, branch } = await ctx(input.organizationId, input.branchId, { bons_commande: ["modifier"] });
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: input.purchaseOrderId, branchId: input.branchId },
    include: { items: true },
  });
  if (!po) throw new Error("Bon de commande introuvable.");
  if (po.status === "VALIDE" || po.status === "ANNULE") {
    throw new Error("Ce bon est déjà clôturé.");
  }

  const byId = new Map(input.lines.map((l) => [l.id, l]));
  let validatedTotal = 0;
  const resolved: Array<{
    item: (typeof po.items)[number];
    receivedQty: number;
    unitPriceUsd: number;
    lineTotalUsd: number;
  }> = [];

  for (const item of po.items) {
    const patch = byId.get(item.id);
    const receivedQty = Math.max(
      0,
      Math.round(Number(patch?.receivedQty ?? item.quantity) || 0),
    );
    const unitPriceUsd = Number(patch?.unitPriceUsd ?? item.unitPriceUsd);
    if (!Number.isFinite(unitPriceUsd) || unitPriceUsd < 0) {
      throw new Error(`Prix invalide pour « ${item.name} ».`);
    }
    const lineTotalUsd =
      patch?.lineTotalUsd != null && Number.isFinite(Number(patch.lineTotalUsd))
        ? roundMoney(Number(patch.lineTotalUsd))
        : roundMoney(receivedQty * unitPriceUsd);
    validatedTotal = roundMoney(validatedTotal + lineTotalUsd);
    resolved.push({ item, receivedQty, unitPriceUsd, lineTotalUsd });
  }

  const already = po.fundsReleasedUsd;

  // Caisse après stock : si création produit échoue, pas de double sortie.
  // (Les fonds déjà sortis restent ; seul le delta est ajusté ici.)

  if (resolved.some((r) => r.receivedQty > 0)) {
    assertBranchProductCatalog(branch.type);
  }

  let productsCreated = 0;
  let productsStocked = 0;

  await prisma.$transaction(async (tx) => {
    for (const row of resolved) {
      let shopProductId = row.item.shopProductId;
      let menuItemId = row.item.menuItemId;
      const name = row.item.name.trim();

      if (row.receivedQty > 0) {
        // Catalogue strictement scopé à la branche du bon (jamais partagé).
        if (branch.type === "BOUTIQUE") {
          let product =
            shopProductId != null
              ? await tx.shopProduct.findFirst({
                  where: { id: shopProductId, branchId: input.branchId },
                })
              : null;
          if (!product) {
            product = await tx.shopProduct.findFirst({
              where: {
                branchId: input.branchId,
                active: true,
                name: { equals: name, mode: "insensitive" },
              },
            });
          }

          if (!product) {
            const catName = normalizeCategoryName(row.item.category);
            let category = await tx.shopCategory.findFirst({
              where: {
                branchId: input.branchId,
                name: { equals: catName, mode: "insensitive" },
              },
            });
            if (!category) {
              category = await tx.shopCategory.create({
                data: { branchId: input.branchId, name: catName },
              });
            }
            const skuBase = name
              .replace(/[^a-zA-Z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .toUpperCase()
              .slice(0, 16);
            const sku = `${skuBase || "ART"}-${Date.now().toString(36).toUpperCase()}`;
            product = await tx.shopProduct.create({
              data: {
                branchId: input.branchId,
                categoryId: category.id,
                name,
                sku,
                price: row.unitPriceUsd,
                stockQty: 0,
                kind: "ARTICLE",
                active: true,
              },
            });
            productsCreated += 1;
          }

          const stockAfter = product.stockQty + row.receivedQty;
          await tx.shopProduct.update({
            where: { id: product.id },
            data: { stockQty: stockAfter },
          });
          await tx.shopStockMovement.create({
            data: {
              branchId: input.branchId,
              productId: product.id,
              kind: "ENTREE",
              quantity: row.receivedQty,
              note: `Bon ${po.number} · entrée stock`,
              createdByUserId: user.id,
            },
          });
          shopProductId = product.id;
          productsStocked += 1;
        } else {
          let item =
            menuItemId != null
              ? await tx.hotelMenuItem.findFirst({
                  where: { id: menuItemId, branchId: input.branchId },
                })
              : null;
          if (!item) {
            item = await tx.hotelMenuItem.findFirst({
              where: {
                branchId: input.branchId,
                active: true,
                name: { equals: name, mode: "insensitive" },
              },
            });
          }

          if (!item) {
            const category = sellableHotelCategory(row.item.category);
            item = await tx.hotelMenuItem.create({
              data: {
                branchId: input.branchId,
                name,
                category,
                price: row.unitPriceUsd,
                stockQty: 0,
                isConsumable: false,
                needsKitchen: defaultNeedsKitchen(category),
                createdByUserId: user.id,
                active: true,
                supplierName: po.supplierName?.trim() || null,
              },
            });
            productsCreated += 1;
          } else if (item.isConsumable) {
            // Anciens bons créés en « Consommables » → rendre vendable
            const category = sellableHotelCategory(
              row.item.category || item.category,
            );
            item = await tx.hotelMenuItem.update({
              where: { id: item.id },
              data: {
                isConsumable: false,
                category,
                price: item.price > 0 ? item.price : row.unitPriceUsd,
                needsKitchen: defaultNeedsKitchen(category),
              },
            });
          }

          const stockBefore = item.stockQty;
          const stockAfter = stockBefore + row.receivedQty;
          await tx.hotelMenuItem.update({
            where: { id: item.id },
            data: { stockQty: stockAfter },
          });
          await tx.hotelStockMovement.create({
            data: {
              branchId: input.branchId,
              menuItemId: item.id,
              kind: "ENTREE",
              quantity: row.receivedQty,
              stockBefore,
              stockAfter,
              note: `Bon ${po.number} · entrée stock`,
              createdByUserId: user.id,
            },
          });
          menuItemId = item.id;
          productsStocked += 1;
        }
      }

      await tx.purchaseOrderItem.update({
        where: { id: row.item.id },
        data: {
          receivedQty: row.receivedQty,
          unitPriceUsd: row.unitPriceUsd,
          lineTotalUsd: row.lineTotalUsd,
          shopProductId,
          menuItemId,
          createProduct: false,
        },
      });
    }

    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: {
        status: "VALIDE",
        validatedAmountUsd: validatedTotal,
        fundsReleasedUsd: Math.max(already, validatedTotal),
        validatedAt: new Date(),
        validatedByUserId: user.id,
      },
    });
  });

  // Ajustement caisse après succès stock (fonds déjà sortis → delta seulement)
  const delta = roundMoney(validatedTotal - already);
  if (delta > 0.01) {
    await createCashMovement({
      branchId: input.branchId,
      userId: user.id,
      amountUsd: -delta,
      note: `Sortie achat · ${po.number}`,
      purchaseOrderId: po.id,
    });
  } else if (delta < -0.01) {
    await createCashMovement({
      branchId: input.branchId,
      userId: user.id,
      amountUsd: Math.abs(delta),
      note: `Remboursement achat · ${po.number}`,
      purchaseOrderId: po.id,
    });
  }

  revalidatePurchases(input.organizationId, input.branchId);
  return {
    ok: true,
    validatedAmountUsd: validatedTotal,
    productsCreated,
    productsStocked,
    branchId: input.branchId,
  };
}

export async function cancelPurchaseOrderAction(input: {
  organizationId: string;
  branchId: string;
  purchaseOrderId: string;
}) {
  const { user } = await ctx(input.organizationId, input.branchId, { bons_commande: ["modifier"] });
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: input.purchaseOrderId, branchId: input.branchId },
  });
  if (!po) throw new Error("Bon de commande introuvable.");
  if (po.status === "VALIDE") {
    throw new Error("Impossible d’annuler un bon déjà validé.");
  }
  if (po.fundsReleasedUsd > 0.01) {
    await createCashMovement({
      branchId: input.branchId,
      userId: user.id,
      amountUsd: po.fundsReleasedUsd,
      note: `Remboursement achat · ${po.number} (annulation)`,
      purchaseOrderId: po.id,
    });
  }
  await prisma.purchaseOrder.update({
    where: { id: po.id },
    data: { status: "ANNULE", fundsReleasedUsd: 0 },
  });
  revalidatePurchases(input.organizationId, input.branchId);
  return { ok: true };
}

/**
 * Pour un bon déjà validé / fonds sortis : crée les produits manquants
 * dans le catalogue et enregistre l’entrée stock si pas encore liée.
 */
export async function syncPurchaseOrderCatalogAction(input: {
  organizationId: string;
  branchId: string;
  purchaseOrderId: string;
}) {
  const { user, branch } = await ctx(input.organizationId, input.branchId, { bons_commande: ["modifier"] });
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: input.purchaseOrderId, branchId: input.branchId },
    include: { items: true },
  });
  if (!po) throw new Error("Bon de commande introuvable.");
  if (po.status !== "VALIDE") {
    throw new Error("Réservé aux bons déjà validés (produits manquants).");
  }

  assertBranchProductCatalog(branch.type);

  let created = 0;
  let stocked = 0;

  await prisma.$transaction(async (tx) => {
    for (const item of po.items) {
      const qty = Math.max(0, item.receivedQty ?? item.quantity);
      if (!(qty > 0)) continue;
      const name = item.name.trim();

      if (branch.type === "BOUTIQUE") {
        if (item.shopProductId) continue;
        let product = await tx.shopProduct.findFirst({
          where: {
            branchId: input.branchId,
            active: true,
            name: { equals: name, mode: "insensitive" },
          },
        });
        if (!product) {
          const catName = normalizeCategoryName(item.category);
          let category = await tx.shopCategory.findFirst({
            where: {
              branchId: input.branchId,
              name: { equals: catName, mode: "insensitive" },
            },
          });
          if (!category) {
            category = await tx.shopCategory.create({
              data: { branchId: input.branchId, name: catName },
            });
          }
          const sku = `BC-${Date.now().toString(36).toUpperCase()}`;
          product = await tx.shopProduct.create({
            data: {
              branchId: input.branchId,
              categoryId: category.id,
              name,
              sku,
              price: item.unitPriceUsd,
              stockQty: 0,
              kind: "ARTICLE",
              active: true,
            },
          });
          created += 1;
        }
        await tx.shopProduct.update({
          where: { id: product.id },
          data: { stockQty: product.stockQty + qty },
        });
        await tx.shopStockMovement.create({
          data: {
            branchId: input.branchId,
            productId: product.id,
            kind: "ENTREE",
            quantity: qty,
            note: `Bon ${po.number} · sync catalogue`,
            createdByUserId: user.id,
          },
        });
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: {
            shopProductId: product.id,
            receivedQty: item.receivedQty ?? qty,
            createProduct: false,
          },
        });
        stocked += 1;
      } else if (branch.type === "HOTEL" || branch.type === "RESTAURANT") {
        let menu = item.menuItemId
          ? await tx.hotelMenuItem.findFirst({
              where: { id: item.menuItemId, branchId: input.branchId },
            })
          : null;
        if (!menu) {
          menu = await tx.hotelMenuItem.findFirst({
            where: {
              branchId: input.branchId,
              active: true,
              name: { equals: name, mode: "insensitive" },
            },
          });
        }

        const category = sellableHotelCategory(item.category || menu?.category);
        if (!menu) {
          menu = await tx.hotelMenuItem.create({
            data: {
              branchId: input.branchId,
              name,
              category,
              price: item.unitPriceUsd,
              stockQty: 0,
              isConsumable: false,
              needsKitchen: defaultNeedsKitchen(category),
              createdByUserId: user.id,
              active: true,
              supplierName: po.supplierName?.trim() || null,
            },
          });
          created += 1;
        } else if (menu.isConsumable || isConsumableCategory(menu.category)) {
          // Anciens produits créés en Consommables → visibles resto / vente rapide
          menu = await tx.hotelMenuItem.update({
            where: { id: menu.id },
            data: {
              isConsumable: false,
              category,
              price: menu.price > 0 ? menu.price : item.unitPriceUsd,
              needsKitchen: defaultNeedsKitchen(category),
            },
          });
        }

        // Déjà lié = stock déjà compté à la validation — pas de double entrée
        if (item.menuItemId) {
          await tx.purchaseOrderItem.update({
            where: { id: item.id },
            data: {
              menuItemId: menu.id,
              createProduct: false,
            },
          });
          continue;
        }

        const stockBefore = menu.stockQty;
        const stockAfter = stockBefore + qty;
        await tx.hotelMenuItem.update({
          where: { id: menu.id },
          data: { stockQty: stockAfter },
        });
        await tx.hotelStockMovement.create({
          data: {
            branchId: input.branchId,
            menuItemId: menu.id,
            kind: "ENTREE",
            quantity: qty,
            stockBefore,
            stockAfter,
            note: `Bon ${po.number} · sync catalogue`,
            createdByUserId: user.id,
          },
        });
        await tx.purchaseOrderItem.update({
          where: { id: item.id },
          data: {
            menuItemId: menu.id,
            receivedQty: item.receivedQty ?? qty,
            createProduct: false,
          },
        });
        stocked += 1;
      }
    }
  });

  revalidatePurchases(input.organizationId, input.branchId);
  return { ok: true, created, stocked };
}

/* ─── Dépenses ─── */

async function nextExpenseNumber(branchId: string, kind: ExpenseKind) {
  const prefix = expenseNumberPrefix(kind);
  const count = await prisma.branchExpense.count({
    where: { branchId, kind },
  });
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

export async function listExpensesAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, { depenses: ["voir"] });
  return prisma.branchExpense.findMany({
    where: { branchId },
    include: { payment: { select: { id: true, receiptNumber: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export async function createExpenseAction(input: {
  organizationId: string;
  branchId: string;
  label: string;
  kind?: string;
  category?: string;
  beneficiary?: string | null;
  amountUsd: number;
  note?: string | null;
  method?: "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK";
}) {
  const { user } = await ctx(input.organizationId, input.branchId, { depenses: ["ajouter"] });
  const kind = normalizeExpenseKind(input.kind);
  const label =
    input.label.trim() ||
    (kind === "DEPOT_BANQUE"
      ? "Dépôt bancaire"
      : kind === "REMISE_PROPRIETAIRE"
        ? "Remise au propriétaire"
        : kind === "PRET_PROPRIETAIRE"
          ? "Prêt / avance propriétaire"
          : "");
  if (!label) throw new Error("Libellé requis.");
  const amountUsd = roundMoney(Number(input.amountUsd));
  if (!(amountUsd > 0)) throw new Error("Montant invalide.");
  const beneficiary = input.beneficiary?.trim() || null;
  if (
    (kind === "DEPOT_BANQUE" ||
      kind === "REMISE_PROPRIETAIRE" ||
      kind === "PRET_PROPRIETAIRE") &&
    !beneficiary
  ) {
    throw new Error(
      kind === "DEPOT_BANQUE"
        ? "Indiquez la banque (bénéficiaire)."
        : "Indiquez le nom du propriétaire.",
    );
  }

  const number = await nextExpenseNumber(input.branchId, kind);
  const category =
    input.category?.trim() || defaultExpenseCategory(kind);
  const signedAmount =
    amountUsd * (kind === "PRET_PROPRIETAIRE" ? 1 : -1);

  const expense = await prisma.branchExpense.create({
    data: {
      branchId: input.branchId,
      number,
      kind,
      label,
      category,
      beneficiary,
      amountUsd,
      note: input.note?.trim() || null,
      createdByUserId: user.id,
    },
  });

  await createCashMovement({
    branchId: input.branchId,
    userId: user.id,
    amountUsd: signedAmount,
    note: expenseCashNote(kind, label),
    expenseId: expense.id,
    method: input.method,
  });

  revalidatePurchases(input.organizationId, input.branchId);
  return expense;
}
