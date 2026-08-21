"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { branchBasePath, boutiqueRoutes } from "@/lib/branch/paths";
import prisma from "@/lib/prisma";
import {
  DEFAULT_WAREHOUSE_CATEGORIES,
  DEFAULT_WAREHOUSE_LOCATIONS,
  formatDeliveryPath,
  formatWarehouseLocation,
  slugSku,
  stockLevel,
  warehouseDestinationLabel,
  warehouseLocationZoneLabel,
  warehouseProductTypeLabel,
  warehouseSlipKindLabel,
  warehouseSlipStatusLabel,
  type WarehouseDestinationCode,
  type WarehouseLocationZoneCode,
  type WarehouseProductTypeCode,
} from "@/lib/warehouse/labels";
import {
  buildWarehouseSlipHtml,
  type WarehouseSlipDocKind,
} from "@/lib/warehouse/print";

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

function revalidateStock(organizationId: string, branchId: string) {
  const base = branchBasePath(organizationId, branchId);
  revalidatePath(`${base}/boutique/stock`);
  revalidatePath(`${base}/boutique/pos`);
  revalidatePath(`${base}/boutique/produits`);
}

async function nextSlipNumber(branchId: string, kind: "COMMANDE" | "SORTIE") {
  const prefix = kind === "COMMANDE" ? "BC" : "BS";
  const count = await prisma.warehouseSlip.count({
    where: { branchId, kind },
  });
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

async function ensureUniqueSku(branchId: string, base: string) {
  let sku = base.slice(0, 28);
  let n = 1;
  while (
    await prisma.warehouseProduct.findFirst({
      where: { branchId, sku },
      select: { id: true },
    })
  ) {
    sku = `${base.slice(0, 24)}-${n}`;
    n += 1;
  }
  return sku;
}

/** Seed catégories + emplacements si la branche n’en a pas encore. */
async function ensureWarehouseTaxonomy(branchId: string) {
  const [catCount, locCount] = await Promise.all([
    prisma.warehouseCategory.count({ where: { branchId } }),
    prisma.warehouseLocation.count({ where: { branchId } }),
  ]);
  if (catCount === 0) {
    const rows: {
      branchId: string;
      productType: WarehouseProductTypeCode;
      name: string;
      sortOrder: number;
    }[] = [];
    for (const [type, names] of Object.entries(DEFAULT_WAREHOUSE_CATEGORIES)) {
      names.forEach((name, i) => {
        rows.push({
          branchId,
          productType: type as WarehouseProductTypeCode,
          name,
          sortOrder: i,
        });
      });
    }
    await prisma.warehouseCategory.createMany({ data: rows });
  }
  if (locCount === 0) {
    await prisma.warehouseLocation.createMany({
      data: DEFAULT_WAREHOUSE_LOCATIONS.map((l) => ({
        branchId,
        zone: l.zone,
        floor: l.floor,
        code: l.code,
        label: l.label,
      })),
    });
  }
}

export async function listWarehouseStaffAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  const members = await prisma.branchMember.findMany({
    where: { branchId, status: "ACTIVE" },
    include: {
      member: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return members.map((m) => ({
    id: m.member.user.id,
    name: m.member.user.name?.trim() || m.member.user.email,
    email: m.member.user.email,
    role: m.role,
  }));
}

export async function getWarehouseDashboardAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  await ensureWarehouseTaxonomy(branchId);

  const [products, slips, movements, staff, categories, locations] =
    await Promise.all([
      prisma.warehouseProduct.findMany({
        where: { branchId, active: true },
        include: {
          category: { select: { id: true, name: true, productType: true } },
          location: true,
          destLocation: true,
        },
        orderBy: [
          { location: { floor: "asc" } },
          { location: { code: "asc" } },
          { name: "asc" },
        ],
      }),
      prisma.warehouseSlip.findMany({
        where: { branchId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  location: true,
                  destLocation: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      prisma.warehouseMovement.findMany({
        where: { branchId },
        include: {
          product: {
            select: {
              name: true,
              sku: true,
              type: true,
              location: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      listWarehouseStaffAction(organizationId, branchId),
      prisma.warehouseCategory.findMany({
        where: { branchId, active: true },
        orderBy: [
          { productType: "asc" },
          { sortOrder: "asc" },
          { name: "asc" },
        ],
      }),
      prisma.warehouseLocation.findMany({
        where: { branchId, active: true },
        orderBy: [{ zone: "asc" }, { floor: "asc" }, { code: "asc" }],
      }),
    ]);

  const alerts = products
    .map((p) => ({
      ...p,
      level: stockLevel(p.stockQty, p.minQty),
      locationLabel: formatWarehouseLocation(p.location),
      destLocationLabel: formatWarehouseLocation(p.destLocation),
      categoryName: p.category?.name ?? null,
      deliveryPath: formatDeliveryPath(p.location, p.destLocation),
    }))
    .filter((p) => p.level !== "ok");

  const userIds = new Set<string>();
  for (const s of slips) {
    userIds.add(s.managerUserId);
    if (s.recipientUserId) userIds.add(s.recipientUserId);
    userIds.add(s.createdByUserId);
    if (s.receivedByUserId) userIds.add(s.receivedByUserId);
  }
  for (const m of movements) userIds.add(m.createdByUserId);
  const users = userIds.size
    ? await prisma.user.findMany({
        where: { id: { in: [...userIds] } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const nameById = new Map(
    users.map((u) => [u.id, u.name || u.email] as const),
  );

  return {
    products: products.map((p) => ({
      ...p,
      level: stockLevel(p.stockQty, p.minQty),
      typeLabel: warehouseProductTypeLabel(p.type),
      categoryName: p.category?.name ?? null,
      locationLabel: formatWarehouseLocation(p.location),
      destLocationLabel: formatWarehouseLocation(p.destLocation),
      deliveryPath: formatDeliveryPath(p.location, p.destLocation),
    })),
    alerts,
    categories: categories.map((c) => ({
      ...c,
      typeLabel: warehouseProductTypeLabel(c.productType),
    })),
    locations: locations.map((l) => ({
      ...l,
      zoneLabel: warehouseLocationZoneLabel(l.zone),
      fullLabel: formatWarehouseLocation(l),
    })),
    slips: slips.map((s) => ({
      ...s,
      kindLabel: warehouseSlipKindLabel(s.kind),
      statusLabel: warehouseSlipStatusLabel(s.status),
      destinationLabel: warehouseDestinationLabel(s.destination),
      managerName: nameById.get(s.managerUserId) ?? "—",
      recipientName: s.recipientUserId
        ? (nameById.get(s.recipientUserId) ?? "—")
        : "—",
      createdByName: nameById.get(s.createdByUserId) ?? "—",
      receivedByName: s.receivedByUserId
        ? (nameById.get(s.receivedByUserId) ?? "—")
        : null,
      items: [...s.items]
        .sort((a, b) => {
          const fa = a.product?.location?.floor ?? "ZZ";
          const fb = b.product?.location?.floor ?? "ZZ";
          if (fa !== fb) return fa.localeCompare(fb, "fr");
          const ca = a.product?.location?.code ?? "";
          const cb = b.product?.location?.code ?? "";
          return ca.localeCompare(cb, "fr");
        })
        .map((i) => ({
          ...i,
          categoryName: i.product?.category?.name ?? null,
          pickFrom: formatWarehouseLocation(i.product?.location),
          putTo: formatWarehouseLocation(i.product?.destLocation),
          deliveryPath: formatDeliveryPath(
            i.product?.location,
            i.product?.destLocation,
          ),
        })),
    })),
    movements: movements.map((m) => ({
      ...m,
      createdByName: nameById.get(m.createdByUserId) ?? "—",
      productName: m.product.name,
      productSku: m.product.sku,
      productType: m.product.type,
      locationLabel: formatWarehouseLocation(m.product.location),
    })),
    staff,
    kpis: {
      products: products.length,
      alerts: alerts.length,
      out: alerts.filter((a) => a.level === "out").length,
      low: alerts.filter((a) => a.level === "low").length,
      draftSlips: slips.filter((s) => s.status === "BROUILLON").length,
      awaitingReception: slips.filter((s) => s.status === "ENVOYE").length,
      categories: categories.length,
      locations: locations.length,
    },
  };
}

export async function upsertWarehouseProductAction(input: {
  organizationId: string;
  branchId: string;
  id?: string;
  name: string;
  sku?: string;
  type: WarehouseProductTypeCode;
  categoryId?: string | null;
  locationId?: string | null;
  destLocationId?: string | null;
  unit?: string;
  minQty?: number;
  unitCostUsd?: number;
  stockQty?: number;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const name = input.name.trim();
  if (!name) throw new Error("Nom produit requis.");
  const type = input.type;

  if (input.categoryId) {
    const cat = await prisma.warehouseCategory.findFirst({
      where: { id: input.categoryId, branchId: input.branchId },
    });
    if (!cat) throw new Error("Catégorie introuvable.");
    if (cat.productType !== type) {
      throw new Error("La catégorie ne correspond pas au type de produit.");
    }
  }

  const locData = {
    categoryId: input.categoryId || null,
    locationId: input.locationId || null,
    destLocationId: input.destLocationId || null,
  };

  if (input.id) {
    const existing = await prisma.warehouseProduct.findFirst({
      where: { id: input.id, branchId: input.branchId },
      select: { id: true },
    });
    if (!existing) throw new Error("Produit introuvable.");
    const row = await prisma.warehouseProduct.update({
      where: { id: input.id },
      data: {
        name,
        type,
        unit: input.unit?.trim() || "pcs",
        minQty: Math.max(0, input.minQty ?? 5),
        unitCostUsd: Math.max(0, input.unitCostUsd ?? 0),
        ...locData,
        ...(input.sku?.trim() ? { sku: input.sku.trim().toUpperCase() } : {}),
      },
    });
    revalidateStock(input.organizationId, input.branchId);
    return row;
  }

  const sku = await ensureUniqueSku(
    input.branchId,
    (input.sku?.trim() || slugSku(name)).toUpperCase(),
  );
  const opening = Math.max(0, Math.floor(input.stockQty ?? 0));
  const product = await prisma.$transaction(async (tx) => {
    const p = await tx.warehouseProduct.create({
      data: {
        branchId: input.branchId,
        name,
        sku,
        type,
        unit: input.unit?.trim() || "pcs",
        minQty: Math.max(0, input.minQty ?? 5),
        unitCostUsd: Math.max(0, input.unitCostUsd ?? 0),
        stockQty: opening,
        ...locData,
      },
    });
    if (opening > 0) {
      await tx.warehouseMovement.create({
        data: {
          branchId: input.branchId,
          productId: p.id,
          kind: "ENTREE",
          quantity: opening,
          stockBefore: 0,
          stockAfter: opening,
          note: "Stock initial",
          createdByUserId: user.id,
        },
      });
    }
    return p;
  });
  revalidateStock(input.organizationId, input.branchId);
  return product;
}

export async function upsertWarehouseCategoryAction(input: {
  organizationId: string;
  branchId: string;
  id?: string;
  productType: WarehouseProductTypeCode;
  name: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const name = input.name.trim();
  if (!name) throw new Error("Nom de catégorie requis.");
  if (input.id) {
    const row = await prisma.warehouseCategory.update({
      where: { id: input.id },
      data: { name, productType: input.productType },
    });
    revalidateStock(input.organizationId, input.branchId);
    return row;
  }
  const max = await prisma.warehouseCategory.aggregate({
    where: { branchId: input.branchId, productType: input.productType },
    _max: { sortOrder: true },
  });
  const row = await prisma.warehouseCategory.create({
    data: {
      branchId: input.branchId,
      productType: input.productType,
      name,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidateStock(input.organizationId, input.branchId);
  return row;
}

export async function upsertWarehouseLocationAction(input: {
  organizationId: string;
  branchId: string;
  id?: string;
  zone: WarehouseLocationZoneCode;
  floor: string;
  code: string;
  label?: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const floor = input.floor.trim() || "RDC";
  const code = input.code.trim().toUpperCase();
  if (!code) throw new Error("Code emplacement requis (ex. A-01, POS-01).");
  if (input.id) {
    const row = await prisma.warehouseLocation.update({
      where: { id: input.id },
      data: {
        zone: input.zone,
        floor,
        code,
        label: input.label?.trim() || null,
      },
    });
    revalidateStock(input.organizationId, input.branchId);
    return row;
  }
  const row = await prisma.warehouseLocation.create({
    data: {
      branchId: input.branchId,
      zone: input.zone,
      floor,
      code,
      label: input.label?.trim() || null,
    },
  });
  revalidateStock(input.organizationId, input.branchId);
  return row;
}

export async function adjustWarehouseStockAction(input: {
  organizationId: string;
  branchId: string;
  productId: string;
  kind: "ENTREE" | "SORTIE" | "AJUSTEMENT";
  quantity: number;
  note?: string;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const qty = Math.floor(input.quantity);
  if (!(qty > 0)) throw new Error("Quantité invalide.");

  await prisma.$transaction(async (tx) => {
    const p = await tx.warehouseProduct.findFirst({
      where: { id: input.productId, branchId: input.branchId },
    });
    if (!p) throw new Error("Produit introuvable.");
    let after = p.stockQty;
    if (input.kind === "ENTREE") after = p.stockQty + qty;
    else if (input.kind === "SORTIE") {
      if (p.stockQty < qty) throw new Error("Stock insuffisant.");
      after = p.stockQty - qty;
    } else {
      after = qty;
    }
    await tx.warehouseProduct.update({
      where: { id: p.id },
      data: { stockQty: after },
    });
    await tx.warehouseMovement.create({
      data: {
        branchId: input.branchId,
        productId: p.id,
        kind: input.kind,
        quantity:
          input.kind === "AJUSTEMENT" ? Math.abs(after - p.stockQty) : qty,
        stockBefore: p.stockQty,
        stockAfter: after,
        note: input.note?.trim() || null,
        createdByUserId: user.id,
      },
    });
  });
  revalidateStock(input.organizationId, input.branchId);
}

export async function createWarehouseSlipAction(input: {
  organizationId: string;
  branchId: string;
  kind: "COMMANDE" | "SORTIE";
  destination?: WarehouseDestinationCode | null;
  supplierName?: string;
  note?: string;
  managerUserId: string;
  recipientUserId?: string | null;
  items: {
    productId?: string | null;
    name: string;
    productType: WarehouseProductTypeCode;
    quantity: number;
    unitCostUsd?: number;
    createProduct?: boolean;
  }[];
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  if (!input.items.length) throw new Error("Ajoutez au moins une ligne.");
  if (!input.managerUserId) throw new Error("Gestionnaire de stock requis.");
  if (input.kind === "SORTIE" && !input.destination) {
    throw new Error("Destination requise pour un bon de sortie.");
  }
  if (input.kind === "SORTIE" && !input.recipientUserId) {
    throw new Error("Réceptionnaire requis pour un bon de sortie.");
  }
  if (input.kind === "SORTIE") {
    const missing = input.items.find((i) => !i.productId);
    if (missing) {
      throw new Error(
        `Choisissez le produit « ${missing.name || "sans nom"} » dans le stock principal (les homonymes se distinguent par le SKU).`,
      );
    }
  }

  const number = await nextSlipNumber(input.branchId, input.kind);
  const slip = await prisma.warehouseSlip.create({
    data: {
      branchId: input.branchId,
      number,
      kind: input.kind,
      status: "BROUILLON",
      destination:
        input.kind === "COMMANDE"
          ? "FOURNISSEUR"
          : (input.destination ?? null),
      supplierName: input.supplierName?.trim() || null,
      note: input.note?.trim() || null,
      managerUserId: input.managerUserId,
      recipientUserId: input.recipientUserId || null,
      createdByUserId: user.id,
      items: {
        create: input.items.map((i) => ({
          productId: i.productId || null,
          name: i.name.trim(),
          productType: i.productType,
          quantity: Math.max(1, Math.floor(i.quantity)),
          unitCostUsd: Math.max(0, i.unitCostUsd ?? 0),
          createProduct: i.createProduct !== false,
        })),
      },
    },
    include: { items: true },
  });
  revalidateStock(input.organizationId, input.branchId);
  return slip;
}

async function upsertWarehouseLineProduct(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  branchId: string,
  item: {
    productId: string | null;
    name: string;
    productType: WarehouseProductTypeCode;
    unitCostUsd: number;
    createProduct: boolean;
    categoryId?: string | null;
  },
) {
  if (item.productId) {
    const existing = await tx.warehouseProduct.findFirst({
      where: { id: item.productId, branchId },
    });
    if (existing) {
      return tx.warehouseProduct.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          type: item.productType,
          unitCostUsd: item.unitCostUsd || existing.unitCostUsd,
          ...(item.categoryId ? { categoryId: item.categoryId } : {}),
        },
      });
    }
  }
  if (!item.createProduct) {
    throw new Error(
      `Produit « ${item.name} » introuvable — sélectionnez-le par SKU (les homonymes sont autorisés).`,
    );
  }
  let categoryId = item.categoryId || null;
  if (!categoryId) {
    const fallback = await tx.warehouseCategory.findFirst({
      where: {
        branchId,
        productType: item.productType,
        name: { in: ["Autre", "Divers"] },
      },
      orderBy: { sortOrder: "asc" },
    });
    categoryId = fallback?.id ?? null;
  }
  const skuBase = slugSku(item.name);
  let sku = skuBase.slice(0, 28);
  let n = 1;
  while (
    await tx.warehouseProduct.findFirst({
      where: { branchId, sku },
      select: { id: true },
    })
  ) {
    sku = `${skuBase.slice(0, 24)}-${n}`;
    n += 1;
  }
  return tx.warehouseProduct.create({
    data: {
      branchId,
      name: item.name,
      sku,
      type: item.productType,
      categoryId,
      unitCostUsd: item.unitCostUsd,
      stockQty: 0,
      minQty: 5,
    },
  });
}

/** Crédit stock auxiliaire (ShopProduct) + mouvement ENTREE. */
async function creditBoutiqueAuxiliaire(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  input: {
    branchId: string;
    name: string;
    quantity: number;
    unitCostUsd: number;
    userId: string;
    warehouseProductId: string;
    slipNumber: string;
  },
) {
  const warehouse = await tx.warehouseProduct.findFirst({
    where: { id: input.warehouseProductId, branchId: input.branchId },
  });

  let shop =
    warehouse?.shopProductId != null
      ? await tx.shopProduct.findFirst({
          where: {
            id: warehouse.shopProductId,
            branchId: input.branchId,
          },
        })
      : null;

  if (!shop) {
    let cat = await tx.shopCategory.findFirst({
      where: { branchId: input.branchId, name: "Boutique" },
    });
    if (!cat) {
      cat = await tx.shopCategory.create({
        data: { branchId: input.branchId, name: "Boutique" },
      });
    }
    const skuBase = slugSku(input.name);
    let sku = skuBase.slice(0, 28);
    let n = 1;
    while (
      await tx.shopProduct.findFirst({
        where: { categoryId: cat.id, sku },
        select: { id: true },
      })
    ) {
      sku = `${skuBase.slice(0, 24)}-${n}`;
      n += 1;
    }
    shop = await tx.shopProduct.create({
      data: {
        branchId: input.branchId,
        categoryId: cat.id,
        name: input.name,
        sku,
        price: Math.max(0, input.unitCostUsd),
        stockQty: 0,
        active: true,
      },
    });
  }

  await tx.shopProduct.update({
    where: { id: shop.id },
    data: { stockQty: { increment: input.quantity } },
  });
  await tx.shopStockMovement.create({
    data: {
      branchId: input.branchId,
      productId: shop.id,
      kind: "ENTREE",
      quantity: input.quantity,
      note: `Bon sortie stock principal ${input.slipNumber} → auxiliaire`,
      createdByUserId: input.userId,
    },
  });
  await tx.warehouseProduct.update({
    where: { id: input.warehouseProductId },
    data: { shopProductId: shop.id },
  });
}

export async function validateWarehouseSlipAction(input: {
  organizationId: string;
  branchId: string;
  slipId: string;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const slip = await prisma.warehouseSlip.findFirst({
    where: { id: input.slipId, branchId: input.branchId },
    include: { items: true },
  });
  if (!slip) throw new Error("Bon introuvable.");
  if (slip.status !== "BROUILLON") throw new Error("Bon déjà traité.");
  if (!slip.items.length) throw new Error("Bon sans lignes.");

  await prisma.$transaction(async (tx) => {
    for (const item of slip.items) {
      const product = await upsertWarehouseLineProduct(tx, input.branchId, {
        productId: item.productId,
        name: item.name,
        productType: item.productType as WarehouseProductTypeCode,
        unitCostUsd: item.unitCostUsd,
        createProduct: item.createProduct,
      });

      if (slip.kind === "COMMANDE") {
        const before = product.stockQty;
        const after = before + item.quantity;
        await tx.warehouseProduct.update({
          where: { id: product.id },
          data: {
            stockQty: after,
            unitCostUsd: item.unitCostUsd || product.unitCostUsd,
          },
        });
        await tx.warehouseMovement.create({
          data: {
            branchId: input.branchId,
            productId: product.id,
            kind: "ENTREE",
            quantity: item.quantity,
            stockBefore: before,
            stockAfter: after,
            note: `Bon commande ${slip.number}`,
            slipId: slip.id,
            createdByUserId: user.id,
          },
        });
        await tx.warehouseSlipItem.update({
          where: { id: item.id },
          data: { productId: product.id },
        });
      } else {
        if (product.stockQty < item.quantity) {
          throw new Error(
            `Stock insuffisant pour « ${product.name} » (dispo ${product.stockQty}).`,
          );
        }
        const before = product.stockQty;
        const after = before - item.quantity;
        await tx.warehouseProduct.update({
          where: { id: product.id },
          data: { stockQty: after },
        });
        await tx.warehouseMovement.create({
          data: {
            branchId: input.branchId,
            productId: product.id,
            kind: "SORTIE",
            quantity: item.quantity,
            stockBefore: before,
            stockAfter: after,
            note: `Bon sortie ${slip.number}`,
            slipId: slip.id,
            createdByUserId: user.id,
          },
        });
        await tx.warehouseSlipItem.update({
          where: { id: item.id },
          data: { productId: product.id },
        });
      }
    }

    const needsReception =
      slip.kind === "SORTIE" && slip.destination === "BOUTIQUE";

    await tx.warehouseSlip.update({
      where: { id: slip.id },
      data: {
        status: needsReception ? "ENVOYE" : "VALIDE",
        validatedAt: new Date(),
      },
    });

    if (needsReception) {
      const itemNames = slip.items
        .slice(0, 4)
        .map((i) => i.name)
        .join(", ");
      const more =
        slip.items.length > 4 ? ` (+${slip.items.length - 4})` : "";
      await tx.branchNotification.create({
        data: {
          branchId: input.branchId,
          title: "Bon stock principal → boutique",
          body: `${slip.number} · ${slip.items.length} produit(s) à réceptionner : ${itemNames}${more}. Contrôle physique puis signature.`,
          kind: "warehouse_shipped",
          href: boutiqueRoutes.pos(input.organizationId, input.branchId),
        },
      });
    }
  });

  revalidateStock(input.organizationId, input.branchId);
  const status =
    slip.kind === "SORTIE" && slip.destination === "BOUTIQUE"
      ? ("ENVOYE" as const)
      : ("VALIDE" as const);
  const printHtml = await renderWarehouseSlipHtml({
    organizationId: input.organizationId,
    branchId: input.branchId,
    slipId: slip.id,
    document: "envoi",
  });
  return {
    ok: true as const,
    slipId: slip.id,
    number: slip.number,
    status,
    printHtml,
  };
}

export async function receiveWarehouseSlipAction(input: {
  organizationId: string;
  branchId: string;
  slipId: string;
  signature: string;
  receiveNote?: string;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const signature = input.signature.trim();
  if (signature.length < 2) {
    throw new Error("Signature requise (nom et prénom du réceptionnaire).");
  }

  const slip = await prisma.warehouseSlip.findFirst({
    where: { id: input.slipId, branchId: input.branchId },
    include: { items: true },
  });
  if (!slip) throw new Error("Bon introuvable.");
  if (slip.kind !== "SORTIE") {
    throw new Error("Ce document n’est pas une sortie.");
  }
  if (slip.destination !== "BOUTIQUE") {
    throw new Error("Destination incorrecte pour la boutique.");
  }
  if (slip.status !== "ENVOYE") {
    throw new Error("Ce bon n’est pas en attente de réception.");
  }
  if (!slip.items.length) throw new Error("Bon sans lignes.");

  await prisma.$transaction(async (tx) => {
    for (const item of slip.items) {
      if (!item.productId) {
        throw new Error(`Ligne « ${item.name} » sans produit stock.`);
      }
      const product = await tx.warehouseProduct.findFirst({
        where: { id: item.productId, branchId: input.branchId },
      });
      if (!product) throw new Error(`Produit « ${item.name} » introuvable.`);

      await creditBoutiqueAuxiliaire(tx, {
        branchId: input.branchId,
        name: product.name,
        quantity: item.quantity,
        unitCostUsd: item.unitCostUsd || product.unitCostUsd,
        userId: user.id,
        warehouseProductId: product.id,
        slipNumber: slip.number,
      });
    }

    await tx.warehouseSlip.update({
      where: { id: slip.id },
      data: {
        status: "RECU",
        receivedAt: new Date(),
        receivedByUserId: user.id,
        recipientSignature: signature,
        receiveNote: input.receiveNote?.trim() || null,
      },
    });

    await tx.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: `Réception bon stock · ${slip.number}`,
        body: `Boutique a signé la réception des produits du stock principal (signé : ${signature}).`,
        kind: "warehouse_received",
        href: boutiqueRoutes.pos(input.organizationId, input.branchId),
      },
    });
  });

  revalidateStock(input.organizationId, input.branchId);
  const printHtml = await renderWarehouseSlipHtml({
    organizationId: input.organizationId,
    branchId: input.branchId,
    slipId: slip.id,
    document: "reception",
  });
  return { ok: true as const, number: slip.number, printHtml };
}

export async function cancelWarehouseSlipAction(input: {
  organizationId: string;
  branchId: string;
  slipId: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const slip = await prisma.warehouseSlip.findFirst({
    where: { id: input.slipId, branchId: input.branchId },
  });
  if (!slip) throw new Error("Bon introuvable.");
  if (slip.status !== "BROUILLON") {
    throw new Error("Seul un brouillon peut être annulé.");
  }
  await prisma.warehouseSlip.update({
    where: { id: slip.id },
    data: { status: "ANNULE" },
  });
  revalidateStock(input.organizationId, input.branchId);
}

async function renderWarehouseSlipHtml(input: {
  organizationId: string;
  branchId: string;
  slipId: string;
  document?: WarehouseSlipDocKind;
}) {
  const { branch } = await ctx(input.organizationId, input.branchId);
  const slip = await prisma.warehouseSlip.findFirst({
    where: { id: input.slipId, branchId: input.branchId },
    include: {
      items: {
        include: {
          product: {
            include: {
              location: true,
              destLocation: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!slip) throw new Error("Bon introuvable.");
  if (
    slip.status !== "VALIDE" &&
    slip.status !== "ENVOYE" &&
    slip.status !== "RECU"
  ) {
    throw new Error("Le bon doit être envoyé, validé ou reçu pour imprimer.");
  }
  const docKind: WarehouseSlipDocKind =
    input.document ?? (slip.status === "RECU" ? "reception" : "envoi");
  if (docKind === "reception" && slip.status !== "RECU") {
    throw new Error("La réception n’est pas encore signée.");
  }
  const users = await prisma.user.findMany({
    where: {
      id: {
        in: [
          slip.managerUserId,
          slip.recipientUserId,
          slip.receivedByUserId,
        ].filter(Boolean) as string[],
      },
    },
    select: { id: true, name: true, email: true },
  });
  const name = (id: string | null) => {
    if (!id) return "—";
    const u = users.find((x) => x.id === id);
    return u?.name || u?.email || "—";
  };

  const lines = [...slip.items].sort((a, b) => {
    const fa = a.product?.location?.floor ?? "ZZ";
    const fb = b.product?.location?.floor ?? "ZZ";
    if (fa !== fb) return fa.localeCompare(fb, "fr");
    return (a.product?.location?.code ?? "").localeCompare(
      b.product?.location?.code ?? "",
      "fr",
    );
  });

  return buildWarehouseSlipHtml({
    branchName: branch.name,
    number: slip.number,
    kindLabel: warehouseSlipKindLabel(slip.kind),
    destinationLabel: warehouseDestinationLabel(slip.destination),
    supplierName: slip.supplierName,
    note: slip.note,
    validatedAt: slip.receivedAt ?? slip.validatedAt ?? slip.updatedAt,
    statusLabel: warehouseSlipStatusLabel(slip.status),
    managerName: name(slip.managerUserId),
    recipientName: name(slip.recipientUserId),
    recipientSignature: slip.recipientSignature,
    receivedAt: slip.receivedAt,
    receiveNote: slip.receiveNote,
    docKind,
    slipKind: slip.kind,
    lines: lines.map((i) => ({
      name: i.name,
      productType: [
        warehouseProductTypeLabel(i.productType),
        i.product?.category?.name,
        i.product?.sku,
      ]
        .filter(Boolean)
        .join(" · "),
      quantity: i.quantity,
      unitCostUsd: i.unitCostUsd,
      pickFrom: formatWarehouseLocation(i.product?.location),
      putTo: formatWarehouseLocation(i.product?.destLocation),
    })),
  });
}

export async function printWarehouseSlipAction(input: {
  organizationId: string;
  branchId: string;
  slipId: string;
  document?: WarehouseSlipDocKind;
}) {
  return renderWarehouseSlipHtml(input);
}

export type PendingPosReception = {
  id: string;
  number: string;
  createdAt: Date;
  managerName: string;
  items: { name: string; sku: string | null; quantity: number }[];
};

/** Bons envoyés depuis le stock principal, en attente de signature POS. */
export async function listPendingPosReceptionsAction(
  organizationId: string,
  branchId: string,
): Promise<PendingPosReception[]> {
  await ctx(organizationId, branchId);
  const slips = await prisma.warehouseSlip.findMany({
    where: {
      branchId,
      kind: "SORTIE",
      destination: "BOUTIQUE",
      status: "ENVOYE",
    },
    include: {
      items: {
        include: { product: { select: { sku: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  const managerIds = [...new Set(slips.map((s) => s.managerUserId))];
  const users = managerIds.length
    ? await prisma.user.findMany({
        where: { id: { in: managerIds } },
        select: { id: true, name: true, email: true },
      })
    : [];
  const nameById = new Map(
    users.map((u) => [u.id, u.name || u.email] as const),
  );
  return slips.map((s) => ({
    id: s.id,
    number: s.number,
    createdAt: s.createdAt,
    managerName: nameById.get(s.managerUserId) ?? "—",
    items: s.items.map((i) => ({
      name: i.name,
      sku: i.product?.sku ?? null,
      quantity: i.quantity,
    })),
  }));
}

/** Ravitaille le POS sans demande : crée le bon de sortie et l’envoie tout de suite. */
export async function shipWarehouseToPosAction(input: {
  organizationId: string;
  branchId: string;
  managerUserId: string;
  recipientUserId: string;
  note?: string;
  items: { productId: string; quantity: number }[];
}) {
  const products = await prisma.warehouseProduct.findMany({
    where: {
      branchId: input.branchId,
      id: { in: input.items.map((i) => i.productId) },
    },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const lines = input.items
    .filter((i) => i.quantity > 0)
    .map((i) => {
      const p = byId.get(i.productId);
      if (!p) throw new Error("Produit introuvable au stock principal.");
      return {
        productId: p.id,
        name: p.name,
        productType: p.type as WarehouseProductTypeCode,
        quantity: Math.floor(i.quantity),
        unitCostUsd: p.unitCostUsd,
        createProduct: false,
      };
    });
  if (!lines.length) throw new Error("Indiquez au moins une quantité à envoyer.");

  const slip = await createWarehouseSlipAction({
    organizationId: input.organizationId,
    branchId: input.branchId,
    kind: "SORTIE",
    destination: "BOUTIQUE",
    note: input.note,
    managerUserId: input.managerUserId,
    recipientUserId: input.recipientUserId,
    items: lines,
  });
  return validateWarehouseSlipAction({
    organizationId: input.organizationId,
    branchId: input.branchId,
    slipId: slip.id,
  });
}
