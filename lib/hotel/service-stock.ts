"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import {
  hasOrganizationPermission,
  requireOrganizationPermission,
} from "@/lib/auth/organization-permission";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { assertHospitalityModule } from "@/lib/branch/hospitality";
import {
  boutiqueRoutes,
  branchBasePath,
  hotelRoutes,
} from "@/lib/branch/paths";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/prisma/client";
import { normalizeOpsRole, OPS_ROLE } from "@/lib/branch/ops-roles";
import { remainingFloat } from "@/lib/hotel/service-stock-print";

export type StorageZone = "MAGASIN" | "CONGELATEUR";

function normalizeZone(value: string | null | undefined): StorageZone {
  return value?.toUpperCase() === "CONGELATEUR" ? "CONGELATEUR" : "MAGASIN";
}

function isCommerceStockBranch(type: string) {
  return type === "BOUTIQUE";
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
  if (!isCommerceStockBranch(branch.type)) {
    assertHospitalityModule(branch, "restaurant");
  }
  return { user: session.user, branch };
}

function revalidateServiceStock(organizationId: string, branchId: string) {
  const base = branchBasePath(organizationId, branchId);
  revalidatePath(base, "layout");
  revalidatePath(hotelRoutes.serviceStock(organizationId, branchId), "page");
  revalidatePath(hotelRoutes.restauration(organizationId, branchId), "page");
  revalidatePath(hotelRoutes.produits(organizationId, branchId), "page");
  revalidatePath(boutiqueRoutes.serviceStock(organizationId, branchId), "page");
  revalidatePath(boutiqueRoutes.pos(organizationId, branchId), "page");
  revalidatePath(boutiqueRoutes.stock(organizationId, branchId), "page");
  revalidatePath(`${base}/caisse`, "page");
}

async function nextSessionNumber(branchId: string) {
  const count = await prisma.serviceStockSession.count({ where: { branchId } });
  return `SS-${String(count + 1).padStart(5, "0")}`;
}

const sessionLineInclude = {
  menuItem: {
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      stockQty: true,
      storageZone: true,
      needsKitchen: true,
    },
  },
  shopProduct: {
    select: {
      id: true,
      name: true,
      price: true,
      stockQty: true,
      category: { select: { name: true } },
    },
  },
} as const;

type SessionLineRecord = {
  menuItemId: string | null;
  shopProductId: string | null;
  menuItem: {
    id: string;
    name: string;
    category?: string;
    price?: number;
    stockQty?: number;
    storageZone?: string;
    needsKitchen?: boolean;
  } | null;
  shopProduct: {
    id: string;
    name: string;
    price?: number;
    stockQty?: number;
    category: { name: string };
  } | null;
};

function clientItemId(line: {
  menuItemId: string | null;
  shopProductId: string | null;
}) {
  return line.shopProductId ?? line.menuItemId ?? "";
}

function clientMenuItem(line: SessionLineRecord) {
  if (line.shopProduct) {
    return {
      id: line.shopProduct.id,
      name: line.shopProduct.name,
      category: line.shopProduct.category.name,
      price: line.shopProduct.price ?? 0,
      stockQty: line.shopProduct.stockQty ?? 0,
      storageZone: "MAGASIN",
      needsKitchen: false,
    };
  }
  const item = line.menuItem;
  if (!item) {
    return {
      id: "",
      name: "Produit",
      category: "",
      price: 0,
      stockQty: 0,
      storageZone: "MAGASIN",
      needsKitchen: false,
    };
  }
  return {
    id: item.id,
    name: item.name,
    category: item.category ?? "",
    price: item.price ?? 0,
    stockQty: item.stockQty ?? 0,
    storageZone: item.storageZone ?? "MAGASIN",
    needsKitchen: Boolean(item.needsKitchen),
  };
}

function mapClientLine<T extends SessionLineRecord>(line: T) {
  const menuItem = clientMenuItem(line);
  return {
    ...line,
    menuItemId: menuItem.id,
    menuItem,
  };
}

export async function listBranchStaffForServiceStockAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  const rows = await prisma.branchMember.findMany({
    where: { branchId, status: "ACTIVE" },
    include: {
      member: { include: { user: { select: { id: true, name: true, email: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    userId: r.member.user.id,
    name: r.member.user.name?.trim() || r.member.user.email || "Membre",
    role: r.role,
  }));
}

export async function listDepotSellableItemsAction(
  organizationId: string,
  branchId: string,
) {
  const { branch } = await ctx(organizationId, branchId);
  if (isCommerceStockBranch(branch.type)) {
    const rows = await prisma.shopProduct.findMany({
      where: { branchId, active: true },
      include: { category: { select: { name: true } } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    });
    return rows.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category.name,
      price: p.price,
      stockQty: p.stockQty,
      storageZone: "MAGASIN",
      barcode: p.barcode,
    }));
  }
  return prisma.hotelMenuItem.findMany({
    where: {
      branchId,
      active: true,
      isConsumable: false,
      needsKitchen: false,
    },
    orderBy: [{ storageZone: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      price: true,
      stockQty: true,
      storageZone: true,
      barcode: true,
    },
  });
}

export async function getOpenServiceStockSessionAction(
  organizationId: string,
  branchId: string,
) {
  const { user } = await ctx(organizationId, branchId);
  const include = {
    lines: {
      include: sessionLineInclude,
      orderBy: { createdAt: "asc" as const },
    },
    topUps: {
      orderBy: { createdAt: "desc" as const },
      take: 50,
    },
  };

  const active = await prisma.serviceStockSession.findFirst({
    where: {
      branchId,
      status: { in: ["DRAFT", "OPEN", "CLOSING"] },
    },
    include,
    orderBy: { openedAt: "desc" },
  });

  if (!active) {
    return { session: null, foreignSession: null, proposedFloat: null };
  }

  const mapped = {
    ...active,
    lines: active.lines.map(mapClientLine),
  };

  const isMine =
    active.vendorUserId === user.id || active.openedByUserId === user.id;

  if (isMine) {
    return { session: mapped, foreignSession: null, proposedFloat: null };
  }

  const proposedFloat = mapped.lines
    .map((l) => ({
      menuItemId: l.menuItemId,
      name: l.menuItem.name,
      quantity: remainingFloat(l),
      unitPriceUsd: l.unitPriceUsd,
      sourceZone: l.sourceZone,
      storageZone: l.menuItem.storageZone,
    }))
    .filter((l) => l.quantity > 0);

  return {
    /** Pas la vôtre — ne pas opérer (réassort / ventes) ; clôture transmission possible. */
    session: null,
    foreignSession: mapped,
    proposedFloat:
      proposedFloat.length > 0
        ? {
            sessionId: active.id,
            number: active.number,
            vendorDisplayName: active.vendorDisplayName,
            lines: proposedFloat,
          }
        : null,
  };
}

/** Snapshot float pour POS / resto (gate + stock restant) — session de l’utilisateur. */
export async function getServiceStockGateAction(
  organizationId: string,
  branchId: string,
) {
  const { user } = await ctx(organizationId, branchId);
  const session = await prisma.serviceStockSession.findFirst({
    where: {
      branchId,
      status: { in: ["DRAFT", "OPEN", "CLOSING"] },
    },
    include: {
      lines: {
        select: {
          id: true,
          menuItemId: true,
          shopProductId: true,
          qtyAttributed: true,
          qtyOpeningCounted: true,
          qtySold: true,
          qtyLoss: true,
          unitPriceUsd: true,
          sourceZone: true,
          menuItem: {
            select: { id: true, name: true, needsKitchen: true },
          },
          shopProduct: {
            select: {
              id: true,
              name: true,
              price: true,
              stockQty: true,
              category: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { openedAt: "desc" },
  });
  if (!session) {
    return {
      ready: false as const,
      session: null,
      foreignSession: null,
      proposedFloat: null,
      floatByItemId: {} as Record<string, number>,
    };
  }

  const isMine =
    session.vendorUserId === user.id || session.openedByUserId === user.id;

  const mappedLines = session.lines.map((l) => {
    const item = clientMenuItem(l);
    return {
      ...l,
      menuItemId: item.id,
      menuItem: { id: item.id, name: item.name, needsKitchen: item.needsKitchen },
    };
  });

  const proposedLines = mappedLines
    .map((l) => ({
      menuItemId: l.menuItemId,
      name: l.menuItem.name,
      quantity: remainingFloat(l),
      unitPriceUsd: l.unitPriceUsd,
    }))
    .filter((l) => l.quantity > 0);

  const sessionSnapshot = {
    id: session.id,
    number: session.number,
    vendorDisplayName: session.vendorDisplayName,
    openedAt: session.openedAt,
    openingConfirmedAt: session.openingConfirmedAt,
    lines: mappedLines,
  };

  const confirmed = Boolean(session.openingConfirmedAt) && session.status === "OPEN";
  const operator = await hasOrganizationPermission(organizationId, {
    service_stock: ["ouvrir"],
  });

  const floatByItemId: Record<string, number> = {};
  if (confirmed) {
    for (const line of session.lines) {
      const id = clientItemId(line);
      if (id) floatByItemId[id] = remainingFloat(line);
    }
  }

  /** Serveur : utilise le float ouvert par le caissier, sans clôturer ni ouvrir. */
  if (!operator) {
    return {
      ready: confirmed,
      session: confirmed ? sessionSnapshot : null,
      foreignSession: null,
      proposedFloat: null,
      floatByItemId: confirmed ? floatByItemId : {},
    };
  }

  if (!isMine) {
    return {
      ready: false as const,
      session: null,
      foreignSession: sessionSnapshot,
      proposedFloat: {
        number: session.number,
        vendorDisplayName: session.vendorDisplayName,
        lines: proposedLines,
      },
      floatByItemId: {} as Record<string, number>,
    };
  }

  return {
    ready: confirmed as true | false,
    session: confirmed ? sessionSnapshot : null,
    foreignSession: null,
    proposedFloat: null,
    floatByItemId,
  };
}

export type LiveShiftSituation = {
  cashOpen: boolean;
  stockOpen: boolean;
  /** Au moins un serveur en ligne (session auth récente). */
  waitersConnected: boolean;
  cashierName: string | null;
  sessionNumber: string | null;
  vendorName: string | null;
  toRecoverUsd: number;
  soldUsd: number;
  recoverRate: number;
  waiters: {
    userId: string;
    name: string;
    connected: boolean;
    qtySold: number;
    amountUsd: number;
  }[];
  products: {
    name: string;
    attributed: number;
    sold: number;
    amountUsd: number;
  }[];
};

const PRESENCE_TTL_MS = 25_000;

function emptyLiveShift(partial?: Partial<LiveShiftSituation>): LiveShiftSituation {
  return {
    cashOpen: false,
    stockOpen: false,
    waitersConnected: false,
    cashierName: null,
    sessionNumber: null,
    vendorName: null,
    toRecoverUsd: 0,
    soldUsd: 0,
    recoverRate: 0,
    waiters: [],
    products: [],
    ...partial,
  };
}

/** Heartbeat serveur : maintient OPEN tant qu’il est sur restauration. */
export async function touchServiceStockPresenceAction(
  organizationId: string,
  branchId: string,
) {
  const { user } = await ctx(organizationId, branchId);
  const now = new Date();
  await prisma.session.updateMany({
    where: { userId: user.id, expiresAt: { gt: now } },
    data: { updatedAt: now },
  });
}

/**
 * Situation live : serveurs connectés (ou ayant vendu) sur la caisse ouverte
 * du caissier qui a ouvert le service stock. Clôture caisse → liste vide.
 */
export async function getLiveShiftSituationAction(
  organizationId: string,
  branchId: string,
): Promise<LiveShiftSituation> {
  const { branch } = await ctx(organizationId, branchId);

  const stock = await prisma.serviceStockSession.findFirst({
    where: {
      branchId,
      status: { in: ["DRAFT", "OPEN", "CLOSING"] },
    },
    include: {
      lines: {
        include: {
          menuItem: { select: { name: true } },
          shopProduct: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { openedAt: "desc" },
  });
  if (!stock) return emptyLiveShift();

  const cashier = await prisma.user.findUnique({
    where: { id: stock.openedByUserId },
    select: { name: true, email: true },
  });
  const cashierName =
    cashier?.name?.trim() ||
    cashier?.email ||
    stock.vendorDisplayName;

  const cash = await prisma.cashSession.findFirst({
    where: {
      branchId,
      status: "OPEN",
      openedByUserId: stock.openedByUserId,
    },
    orderBy: { openedAt: "desc" },
  });
  if (!cash) {
    return emptyLiveShift({ stockOpen: true, cashierName });
  }

  const since =
    cash.openedAt > stock.openedAt ? cash.openedAt : stock.openedAt;

  const members = await prisma.branchMember.findMany({
    where: { branchId, status: "ACTIVE" },
    include: {
      member: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
  const waiterById = new Map<string, { name: string }>();
  for (const row of members) {
    if (normalizeOpsRole(row.role) !== OPS_ROLE.SERVEUR) continue;
    const u = row.member.user;
    waiterById.set(u.id, {
      name: u.name?.trim() || u.email || "Serveur",
    });
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - PRESENCE_TTL_MS);
  const waiterIdsForPresence = [...waiterById.keys()];
  const sessions =
    waiterIdsForPresence.length > 0
      ? await prisma.session.findMany({
          where: {
            expiresAt: { gt: now },
            userId: { in: waiterIdsForPresence },
          },
          select: { userId: true, updatedAt: true },
        })
      : [];
  const loggedInIds = new Set(sessions.map((s) => s.userId));
  const connectedIds = new Set(
    sessions
      .filter((s) => s.updatedAt >= cutoff)
      .map((s) => s.userId),
  );
  const waitersConnected = connectedIds.size > 0;

  const soldByUser = new Map<string, { qty: number; amountUsd: number }>();
  const soldByProduct = new Map<string, { qty: number; amountUsd: number }>();
  const attributedByName = new Map(
    stock.lines.map((l) => [
      l.shopProduct?.name ?? l.menuItem?.name ?? "Produit",
      l.qtyAttributed,
    ]),
  );

  if (isCommerceStockBranch(branch.type)) {
    const sales = await prisma.shopSale.findMany({
      where: {
        branchId,
        status: "ENCAISSEE",
        paidAt: { gte: since },
      },
      select: {
        cashierUserId: true,
        items: {
          select: { name: true, quantity: true, unitPrice: true },
        },
      },
    });
    for (const sale of sales) {
      const uid = sale.cashierUserId ?? stock.openedByUserId;
      for (const item of sale.items) {
        const qty = Math.max(0, item.quantity);
        const amount = qty * (Number(item.unitPrice) || 0);
        const cur = soldByUser.get(uid) ?? { qty: 0, amountUsd: 0 };
        cur.qty += qty;
        cur.amountUsd += amount;
        soldByUser.set(uid, cur);
        const p = soldByProduct.get(item.name) ?? { qty: 0, amountUsd: 0 };
        p.qty += qty;
        p.amountUsd += amount;
        soldByProduct.set(item.name, p);
      }
    }
  } else {
    const orders = await prisma.hotelOrder.findMany({
      where: {
        branchId,
        status: { notIn: ["ANNULEE", "BROUILLON"] },
        OR: [
          { sentAt: { gte: since } },
          { AND: [{ sentAt: null }, { createdAt: { gte: since } }] },
        ],
      },
      select: {
        createdByUserId: true,
        items: {
          select: {
            name: true,
            quantity: true,
            amount: true,
            needsKitchen: true,
            menuItemId: true,
          },
        },
      },
    });

    for (const order of orders) {
      const isWaiter = waiterById.has(order.createdByUserId);
      const isCashier = order.createdByUserId === stock.openedByUserId;
      if (!isWaiter && !isCashier) continue;
      for (const item of order.items) {
        if (item.needsKitchen) continue;
        const qty = Math.max(0, item.quantity);
        const amount = Number(item.amount) || 0;
        const cur = soldByUser.get(order.createdByUserId) ?? {
          qty: 0,
          amountUsd: 0,
        };
        cur.qty += qty;
        cur.amountUsd += amount;
        soldByUser.set(order.createdByUserId, cur);
        const pname = item.name;
        const p = soldByProduct.get(pname) ?? { qty: 0, amountUsd: 0 };
        p.qty += qty;
        p.amountUsd += amount;
        soldByProduct.set(pname, p);
      }
    }
  }

  const waiterIds = new Set<string>([
    ...connectedIds,
    ...loggedInIds,
    ...[...soldByUser.keys()].filter((id) => waiterById.has(id)),
  ]);

  const waiters = [...waiterIds]
    .map((userId) => {
      const sold = soldByUser.get(userId) ?? { qty: 0, amountUsd: 0 };
      return {
        userId,
        name: waiterById.get(userId)?.name ?? "Serveur",
        connected: connectedIds.has(userId),
        qtySold: sold.qty,
        amountUsd: Math.round(sold.amountUsd * 100) / 100,
      };
    })
    .sort((a, b) => b.amountUsd - a.amountUsd || a.name.localeCompare(b.name, "fr"));

  const cashierSold = soldByUser.get(stock.openedByUserId);
  if (cashierSold && cashierSold.qty > 0) {
    waiters.unshift({
      userId: stock.openedByUserId,
      name: `${cashierName} (caisse)`,
      connected: connectedIds.has(stock.openedByUserId),
      qtySold: cashierSold.qty,
      amountUsd: Math.round(cashierSold.amountUsd * 100) / 100,
    });
  }

  const productNames = new Set([
    ...stock.lines.map(
      (l) => l.shopProduct?.name ?? l.menuItem?.name ?? "Produit",
    ),
    ...soldByProduct.keys(),
  ]);
  const products = [...productNames].map((name) => {
    const sold = soldByProduct.get(name) ?? { qty: 0, amountUsd: 0 };
    return {
      name,
      attributed: attributedByName.get(name) ?? 0,
      sold: sold.qty,
      amountUsd: Math.round(sold.amountUsd * 100) / 100,
    };
  });

  const soldUsd =
    Math.round(
      products.reduce((s, p) => s + p.amountUsd, 0) * 100,
    ) / 100;
  let toRecoverUsd = 0;
  for (const l of stock.lines) {
    const qty =
      l.qtyOpeningCounted != null ? l.qtyOpeningCounted : l.qtyAttributed;
    toRecoverUsd += Math.max(0, qty) * l.unitPriceUsd;
  }
  toRecoverUsd = Math.round(toRecoverUsd * 100) / 100;
  const recoverRate =
    toRecoverUsd > 0.0001
      ? Math.round((soldUsd / toRecoverUsd) * 1000) / 10
      : 0;

  return {
    cashOpen: true,
    stockOpen: true,
    waitersConnected,
    cashierName,
    sessionNumber: stock.number,
    vendorName: stock.vendorDisplayName,
    toRecoverUsd,
    soldUsd,
    recoverRate,
    waiters,
    products,
  };
}

export async function listServiceStockSessionsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.serviceStockSession.findMany({
    where: { branchId, status: "CLOSED" },
    orderBy: { openedAt: "desc" },
    take: 30,
    include: {
      lines: {
        select: {
          qtyAttributed: true,
          qtyOpeningCounted: true,
          qtySold: true,
          qtyLoss: true,
          unitPriceUsd: true,
        },
      },
    },
  });
}

/** Float restant transmis (clôture HANDOVER non encore reprise). */
export async function getPendingHandoverFloatAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  const session = await prisma.serviceStockSession.findFirst({
    where: {
      branchId,
      status: "CLOSED",
      closeDisposition: "HANDOVER",
      handoverClaimedBySessionId: null,
    },
    orderBy: { closedAt: "desc" },
    include: {
      lines: {
        where: { qtyClosingCounted: { gt: 0 } },
        include: {
          menuItem: {
            select: {
              id: true,
              name: true,
              category: true,
              price: true,
              stockQty: true,
              storageZone: true,
            },
          },
          shopProduct: {
            select: {
              id: true,
              name: true,
              price: true,
              stockQty: true,
              category: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!session) return null;
  const lines = session.lines
    .map((l) => {
      const item = clientMenuItem(l);
      return {
        menuItemId: item.id,
        name: item.name,
        quantity: l.qtyClosingCounted ?? 0,
        unitPriceUsd: l.unitPriceUsd,
        sourceZone: l.sourceZone,
        storageZone: item.storageZone,
      };
    })
    .filter((l) => l.quantity > 0 && l.menuItemId);
  if (lines.length === 0) return null;
  return {
    sessionId: session.id,
    number: session.number,
    vendorDisplayName: session.vendorDisplayName,
    closedAt: session.closedAt,
    lines,
  };
}

export async function openServiceStockSessionAction(input: {
  organizationId: string;
  branchId: string;
  vendorUserId: string;
  lines: {
    menuItemId: string;
    quantity: number;
    sourceZone?: string;
  }[];
  /** Reprendre le float restant de la dernière clôture « transmission ». */
  inheritHandover?: boolean;
  notes?: string | null;
}) {
  const { user, branch } = await ctx(input.organizationId, input.branchId);
  const commerce = isCommerceStockBranch(branch.type);
  await requireOrganizationPermission(input.organizationId, {
    service_stock: ["ouvrir"],
  });
  const vendorUserId = input.vendorUserId.trim();
  if (!vendorUserId) throw new Error("Choisissez l’entrant.");

  const open = await prisma.serviceStockSession.findFirst({
    where: {
      branchId: input.branchId,
      status: { in: ["DRAFT", "OPEN", "CLOSING"] },
    },
  });
  if (open) {
    throw new Error(
      `Session stock encore ouverte (${open.number} · ${open.vendorDisplayName}). Elle reste à cet entrant jusqu’à clôture — clôturez-la (transmission), puis ouvrez la vôtre.`,
    );
  }

  const member = await prisma.branchMember.findFirst({
    where: {
      branchId: input.branchId,
      status: "ACTIVE",
      member: { userId: vendorUserId },
    },
    include: {
      member: { include: { user: { select: { name: true, email: true } } } },
    },
  });
  if (!member) throw new Error("Entrant invalide pour cette branche.");
  const vendorDisplayName =
    member.member.user.name?.trim() ||
    member.member.user.email ||
    "Entrant";

  const handover = input.inheritHandover
    ? await prisma.serviceStockSession.findFirst({
        where: {
          branchId: input.branchId,
          status: "CLOSED",
          closeDisposition: "HANDOVER",
          handoverClaimedBySessionId: null,
        },
        orderBy: { closedAt: "desc" },
        include: {
          lines: {
            where: { qtyClosingCounted: { gt: 0 } },
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  storageZone: true,
                  active: true,
                  isConsumable: true,
                  needsKitchen: true,
                },
              },
              shopProduct: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                  active: true,
                  category: { select: { name: true } },
                },
              },
            },
          },
        },
      })
    : null;

  const inheritLines =
    handover?.lines
      .map((l) => {
        const item = clientMenuItem(l);
        return {
          menuItemId: item.id,
          quantity: Math.max(0, Math.round(l.qtyClosingCounted ?? 0)),
          sourceZone: normalizeZone(l.sourceZone),
          unitPriceUsd: l.unitPriceUsd || item.price,
          name: item.name,
        };
      })
      .filter((l) => l.quantity > 0 && l.menuItemId) ?? [];

  const cleaned = input.lines
    .map((l) => ({
      menuItemId: l.menuItemId,
      quantity: Math.max(0, Math.round(Number(l.quantity) || 0)),
      sourceZone: normalizeZone(l.sourceZone),
    }))
    .filter((l) => l.quantity > 0);

  if (inheritLines.length === 0 && cleaned.length === 0) {
    throw new Error(
      "Attribuez au moins un produit, ou héritez du float transmis.",
    );
  }

  const depotIds = [...new Set(cleaned.map((l) => l.menuItemId))];
  type DepotItem = {
    id: string;
    name: string;
    price: number;
    stockQty: number;
    storageZone?: string | null;
  };
  let items: DepotItem[] = [];
  if (depotIds.length > 0) {
    if (commerce) {
      items = await prisma.shopProduct.findMany({
        where: {
          branchId: input.branchId,
          id: { in: depotIds },
          active: true,
        },
      });
    } else {
      items = await prisma.hotelMenuItem.findMany({
        where: {
          branchId: input.branchId,
          id: { in: depotIds },
          active: true,
          isConsumable: false,
          needsKitchen: false,
        },
      });
    }
  }
  if (items.length !== depotIds.length) {
    throw new Error(
      commerce
        ? "Un ou plusieurs articles POS sont invalides (actifs uniquement)."
        : "Un ou plusieurs articles sont invalides (hors cuisine / actifs uniquement).",
    );
  }
  const byId = new Map(items.map((i) => [i.id, i]));
  for (const line of cleaned) {
    const item = byId.get(line.menuItemId)!;
    if (item.stockQty < line.quantity) {
      throw new Error(
        `Stock dépôt insuffisant pour « ${item.name} » (dispo ${item.stockQty}).`,
      );
    }
  }

  const number = await nextSessionNumber(input.branchId);
  const noteParts = [
    input.notes?.trim() || null,
    handover && inheritLines.length > 0
      ? `Hérité de ${handover.number} (${handover.vendorDisplayName})`
      : null,
  ].filter(Boolean);

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceStockSession.create({
      data: {
        branchId: input.branchId,
        number,
        status: "DRAFT",
        vendorUserId,
        vendorDisplayName,
        openedByUserId: user.id,
        inheritedFromSessionId: handover?.id ?? null,
        notes: noteParts.length > 0 ? noteParts.join(" · ") : null,
      },
    });

    const attributed = new Map<
      string,
      { qty: number; sourceZone: StorageZone; unitPriceUsd: number }
    >();

    for (const line of inheritLines) {
      const cur = attributed.get(line.menuItemId);
      if (cur) {
        cur.qty += line.quantity;
      } else {
        attributed.set(line.menuItemId, {
          qty: line.quantity,
          sourceZone: line.sourceZone,
          unitPriceUsd: line.unitPriceUsd,
        });
      }
    }

    for (const line of cleaned) {
      const item = byId.get(line.menuItemId)!;
      const stockBefore = item.stockQty;
      const stockAfter = stockBefore - line.quantity;
      if (commerce) {
        await tx.shopProduct.update({
          where: { id: item.id },
          data: { stockQty: stockAfter },
        });
        await tx.shopStockMovement.create({
          data: {
            branchId: input.branchId,
            productId: item.id,
            kind: "SORTIE",
            quantity: line.quantity,
            note: `Service ${number} · SORTIE_DEPOT · ouverture`,
            createdByUserId: user.id,
          },
        });
      } else {
        await tx.hotelMenuItem.update({
          where: { id: item.id },
          data: { stockQty: stockAfter },
        });
        await tx.hotelStockMovement.create({
          data: {
            branchId: input.branchId,
            menuItemId: item.id,
            kind: "SORTIE",
            quantity: line.quantity,
            stockBefore,
            stockAfter,
            note: `Service ${number} · SORTIE_DEPOT · ouverture`,
            createdByUserId: user.id,
          },
        });
      }
      item.stockQty = stockAfter;
      const cur = attributed.get(line.menuItemId);
      if (cur) {
        cur.qty += line.quantity;
        cur.sourceZone = line.sourceZone;
        cur.unitPriceUsd = item.price;
      } else {
        attributed.set(line.menuItemId, {
          qty: line.quantity,
          sourceZone: line.sourceZone || normalizeZone(item.storageZone),
          unitPriceUsd: item.price,
        });
      }
    }

    for (const [itemId, row] of attributed) {
      await tx.serviceStockLine.create({
        data: commerce
          ? {
              sessionId: created.id,
              shopProductId: itemId,
              qtyAttributed: row.qty,
              unitPriceUsd: row.unitPriceUsd,
              sourceZone: row.sourceZone,
            }
          : {
              sessionId: created.id,
              menuItemId: itemId,
              qtyAttributed: row.qty,
              unitPriceUsd: row.unitPriceUsd,
              sourceZone: row.sourceZone,
            },
      });
    }

    if (handover && inheritLines.length > 0) {
      await tx.serviceStockSession.update({
        where: { id: handover.id },
        data: { handoverClaimedBySessionId: created.id },
      });
    }

    return created;
  });

  revalidateServiceStock(input.organizationId, input.branchId);
  return session;
}

export async function confirmServiceStockOpeningAction(input: {
  organizationId: string;
  branchId: string;
  sessionId: string;
  counts: { lineId: string; qtyOpeningCounted: number }[];
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  await requireOrganizationPermission(input.organizationId, {
    service_stock: ["ouvrir"],
  });
  const session = await prisma.serviceStockSession.findFirst({
    where: {
      id: input.sessionId,
      branchId: input.branchId,
      status: { in: ["DRAFT", "OPEN"] },
    },
    include: { lines: true },
  });
  if (!session) throw new Error("Session introuvable.");
  if (
    session.vendorUserId !== user.id &&
    session.openedByUserId !== user.id
  ) {
    throw new Error(
      "Cette session stock appartient à un autre entrant. Clôturez-la en transmission si besoin, puis ouvrez la vôtre.",
    );
  }
  if (session.openingConfirmedAt && session.status === "OPEN") {
    throw new Error("État des lieux déjà confirmé.");
  }

  const countMap = new Map(
    input.counts.map((c) => [
      c.lineId,
      Math.max(0, Math.round(Number(c.qtyOpeningCounted) || 0)),
    ]),
  );

  await prisma.$transaction(async (tx) => {
    for (const line of session.lines) {
      const counted = countMap.get(line.id);
      if (counted == null) {
        throw new Error("Comptage incomplet pour l’état des lieux.");
      }
      await tx.serviceStockLine.update({
        where: { id: line.id },
        data: { qtyOpeningCounted: counted },
      });
    }
    await tx.serviceStockSession.update({
      where: { id: session.id },
      data: {
        status: "OPEN",
        openingConfirmedAt: new Date(),
        openingDocumentPrintedAt: new Date(),
      },
    });
  });

  revalidateServiceStock(input.organizationId, input.branchId);
  return { ok: true, confirmedBy: user.id };
}

export async function markOpeningDocumentPrintedAction(input: {
  organizationId: string;
  branchId: string;
  sessionId: string;
}) {
  await ctx(input.organizationId, input.branchId);
  await prisma.serviceStockSession.updateMany({
    where: { id: input.sessionId, branchId: input.branchId },
    data: { openingDocumentPrintedAt: new Date() },
  });
  revalidateServiceStock(input.organizationId, input.branchId);
  return { ok: true };
}

export async function topUpServiceStockAction(input: {
  organizationId: string;
  branchId: string;
  sessionId: string;
  menuItemId: string;
  quantity: number;
  sourceZone?: string;
  note?: string | null;
}) {
  const { user, branch } = await ctx(input.organizationId, input.branchId);
  const commerce = isCommerceStockBranch(branch.type);
  await requireOrganizationPermission(input.organizationId, {
    service_stock: ["modifier"],
  });
  const qty = Math.max(0, Math.round(Number(input.quantity) || 0));
  if (!(qty > 0)) throw new Error("Quantité invalide.");
  const zone = normalizeZone(input.sourceZone);

  const session = await prisma.serviceStockSession.findFirst({
    where: {
      id: input.sessionId,
      branchId: input.branchId,
      status: "OPEN",
      openingConfirmedAt: { not: null },
    },
  });
  if (!session) throw new Error("Session ouverte requise.");
  if (
    session.vendorUserId !== user.id &&
    session.openedByUserId !== user.id
  ) {
    throw new Error(
      "Réassort réservé à l’entrant / ouvreur de cette session stock.",
    );
  }

  const item = commerce
    ? await prisma.shopProduct.findFirst({
        where: {
          id: input.menuItemId,
          branchId: input.branchId,
          active: true,
        },
      })
    : await prisma.hotelMenuItem.findFirst({
        where: {
          id: input.menuItemId,
          branchId: input.branchId,
          active: true,
          isConsumable: false,
          needsKitchen: false,
        },
      });
  if (!item) throw new Error("Article invalide.");
  if (item.stockQty < qty) {
    throw new Error(
      `Stock dépôt insuffisant pour « ${item.name} » (dispo ${item.stockQty}).`,
    );
  }

  await prisma.$transaction(async (tx) => {
    const stockBefore = item.stockQty;
    const stockAfter = stockBefore - qty;
    if (commerce) {
      await tx.shopProduct.update({
        where: { id: item.id },
        data: { stockQty: stockAfter },
      });
      await tx.shopStockMovement.create({
        data: {
          branchId: input.branchId,
          productId: item.id,
          kind: "SORTIE",
          quantity: qty,
          note: `Service ${session.number} · SORTIE_DEPOT · réassort`,
          createdByUserId: user.id,
        },
      });
      await tx.serviceStockTopUp.create({
        data: {
          sessionId: session.id,
          shopProductId: item.id,
          quantity: qty,
          sourceZone: zone,
          note: input.note?.trim() || null,
          createdByUserId: user.id,
        },
      });
      const existing = await tx.serviceStockLine.findUnique({
        where: {
          sessionId_shopProductId: {
            sessionId: session.id,
            shopProductId: item.id,
          },
        },
      });
      if (existing) {
        await tx.serviceStockLine.update({
          where: { id: existing.id },
          data: {
            qtyAttributed: existing.qtyAttributed + qty,
            sourceZone: zone,
          },
        });
      } else {
        await tx.serviceStockLine.create({
          data: {
            sessionId: session.id,
            shopProductId: item.id,
            qtyAttributed: qty,
            qtyOpeningCounted: qty,
            unitPriceUsd: item.price,
            sourceZone: zone,
          },
        });
      }
    } else {
      await tx.hotelMenuItem.update({
        where: { id: item.id },
        data: { stockQty: stockAfter },
      });
      await tx.hotelStockMovement.create({
        data: {
          branchId: input.branchId,
          menuItemId: item.id,
          kind: "SORTIE",
          quantity: qty,
          stockBefore,
          stockAfter,
          note: `Service ${session.number} · SORTIE_DEPOT · réassort`,
          createdByUserId: user.id,
        },
      });
      await tx.serviceStockTopUp.create({
        data: {
          sessionId: session.id,
          menuItemId: item.id,
          quantity: qty,
          sourceZone: zone,
          note: input.note?.trim() || null,
          createdByUserId: user.id,
        },
      });
      const existing = await tx.serviceStockLine.findUnique({
        where: {
          sessionId_menuItemId: {
            sessionId: session.id,
            menuItemId: item.id,
          },
        },
      });
      if (existing) {
        await tx.serviceStockLine.update({
          where: { id: existing.id },
          data: {
            qtyAttributed: existing.qtyAttributed + qty,
            sourceZone: zone,
          },
        });
      } else {
        await tx.serviceStockLine.create({
          data: {
            sessionId: session.id,
            menuItemId: item.id,
            qtyAttributed: qty,
            qtyOpeningCounted: qty,
            unitPriceUsd: item.price,
            sourceZone: zone,
          },
        });
      }
    }
  });

  revalidateServiceStock(input.organizationId, input.branchId);
  return { ok: true };
}

export async function closeServiceStockSessionAction(input: {
  organizationId: string;
  branchId: string;
  sessionId: string;
  /** HANDOVER = float restant transmis au prochain entrant ; RETURN_DEPOT = retour magasin. */
  disposition?: "HANDOVER" | "RETURN_DEPOT";
  counts: {
    lineId: string;
    qtyClosingCounted: number;
    qtyLoss?: number;
  }[];
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  await requireOrganizationPermission(input.organizationId, {
    service_stock: ["fermer"],
  });
  const disposition = input.disposition === "RETURN_DEPOT" ? "RETURN_DEPOT" : "HANDOVER";
  const session = await prisma.serviceStockSession.findFirst({
    where: {
      id: input.sessionId,
      branchId: input.branchId,
      status: { in: ["DRAFT", "OPEN", "CLOSING"] },
    },
    include: { lines: { include: { menuItem: true, shopProduct: true } } },
  });
  if (!session) throw new Error("Session ouverte introuvable.");

  const countMap = new Map(
    input.counts.map((c) => [
      c.lineId,
      {
        qtyClosingCounted: Math.max(
          0,
          Math.round(Number(c.qtyClosingCounted) || 0),
        ),
        qtyLoss: Math.max(0, Math.round(Number(c.qtyLoss) || 0)),
      },
    ]),
  );

  await prisma.$transaction(async (tx) => {
    for (const line of session.lines) {
      const c = countMap.get(line.id);
      if (!c) throw new Error("Comptage de clôture incomplet.");
      const theoretical = remainingFloat({
        qtyAttributed: line.qtyAttributed,
        qtySold: line.qtySold,
        qtyLoss: c.qtyLoss,
      });
      const counted = c.qtyClosingCounted;
      const toReturn =
        disposition === "RETURN_DEPOT"
          ? Math.min(counted, theoretical)
          : 0;
      if (toReturn > 0) {
        if (line.shopProductId && line.shopProduct) {
          const stockBefore = line.shopProduct.stockQty;
          const stockAfter = stockBefore + toReturn;
          await tx.shopProduct.update({
            where: { id: line.shopProductId },
            data: { stockQty: stockAfter },
          });
          await tx.shopStockMovement.create({
            data: {
              branchId: input.branchId,
              productId: line.shopProductId,
              kind: "ENTREE",
              quantity: toReturn,
              note: `Service ${session.number} · RETOUR_DEPOT · clôture`,
              createdByUserId: user.id,
            },
          });
          line.shopProduct.stockQty = stockAfter;
        } else if (line.menuItemId && line.menuItem) {
          const stockBefore = line.menuItem.stockQty;
          const stockAfter = stockBefore + toReturn;
          await tx.hotelMenuItem.update({
            where: { id: line.menuItemId },
            data: { stockQty: stockAfter },
          });
          await tx.hotelStockMovement.create({
            data: {
              branchId: input.branchId,
              menuItemId: line.menuItemId,
              kind: "ENTREE",
              quantity: toReturn,
              stockBefore,
              stockAfter,
              note: `Service ${session.number} · RETOUR_DEPOT · clôture`,
              createdByUserId: user.id,
            },
          });
          line.menuItem.stockQty = stockAfter;
        } else {
          throw new Error("Ligne stock invalide.");
        }
      }
      await tx.serviceStockLine.update({
        where: { id: line.id },
        data: {
          qtyClosingCounted: counted,
          qtyLoss: c.qtyLoss,
          qtyReturnedToDepot: toReturn,
        },
      });
    }
    await tx.serviceStockSession.update({
      where: { id: session.id },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedByManagerUserId: user.id,
        closingDocumentPrintedAt: new Date(),
        closeDisposition: disposition,
      },
    });
  });

  revalidateServiceStock(input.organizationId, input.branchId);
  return { ok: true, disposition };
}

/** Décrémente le float (hors cuisine) dans une transaction vente/commande. */
export async function consumeServiceFloatInTx(
  tx: Prisma.TransactionClient,
  branchId: string,
  lines: { menuItemId: string; quantity: number }[],
  _userId?: string,
) {
  const session = await tx.serviceStockSession.findFirst({
    where: {
      branchId,
      status: "OPEN",
      openingConfirmedAt: { not: null },
    },
    include: {
      lines: {
        include: {
          menuItem: {
            select: { id: true, name: true, needsKitchen: true },
          },
        },
      },
    },
  });
  if (!session) {
    throw new Error(
      "Le caissier doit ouvrir et confirmer le service stock avant de vendre hors cuisine.",
    );
  }

  const floatLines = new Map(
    session.lines
      .filter((l) => l.menuItemId && l.menuItem)
      .map((l) => [l.menuItemId as string, l]),
  );
  const needed = new Map<string, number>();
  for (const line of lines) {
    needed.set(
      line.menuItemId,
      (needed.get(line.menuItemId) ?? 0) + Math.max(1, line.quantity),
    );
  }

  for (const [menuItemId, qty] of needed) {
    const fl = floatLines.get(menuItemId);
    if (!fl?.menuItem || fl.menuItem.needsKitchen) {
      throw new Error(
        "Article hors float service — attribuez-le via Service stock ou utilisez un produit cuisine.",
      );
    }
    const rem = remainingFloat(fl);
    if (rem < qty) {
      throw new Error(
        `Float insuffisant pour « ${fl.menuItem.name} » (restant ${rem}). Demandez un réassort au caissier.`,
      );
    }
  }

  for (const [menuItemId, qty] of needed) {
    const fl = floatLines.get(menuItemId)!;
    await tx.serviceStockLine.update({
      where: { id: fl.id },
      data: { qtySold: fl.qtySold + qty },
    });
  }

  return session.id;
}

/** Décrémente le float POS commerce dans une transaction vente. */
export async function consumeShopServiceFloatInTx(
  tx: Prisma.TransactionClient,
  branchId: string,
  lines: { productId: string; quantity: number; name?: string }[],
  opts?: { excludeSaleId?: string },
) {
  const session = await tx.serviceStockSession.findFirst({
    where: {
      branchId,
      status: "OPEN",
      openingConfirmedAt: { not: null },
    },
    include: {
      lines: {
        include: {
          shopProduct: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!session) {
    throw new Error(
      "Ouvrez et confirmez le service stock avant de vendre au point de vente.",
    );
  }

  const holds = await tx.shopSale.findMany({
    where: {
      branchId,
      status: "EN_ATTENTE",
      ...(opts?.excludeSaleId ? { id: { not: opts.excludeSaleId } } : {}),
    },
    include: { items: true },
  });
  const heldMap = new Map<string, number>();
  for (const sale of holds) {
    for (const item of sale.items) {
      if (!item.productId) continue;
      heldMap.set(
        item.productId,
        (heldMap.get(item.productId) ?? 0) + item.quantity,
      );
    }
  }

  const floatLines = new Map(
    session.lines
      .filter((l) => l.shopProductId)
      .map((l) => [l.shopProductId as string, l]),
  );
  const needed = new Map<string, number>();
  for (const line of lines) {
    if (!line.productId) continue;
    needed.set(
      line.productId,
      (needed.get(line.productId) ?? 0) + Math.max(1, line.quantity),
    );
  }

  for (const [productId, qty] of needed) {
    const fl = floatLines.get(productId);
    const name =
      fl?.shopProduct?.name ??
      lines.find((l) => l.productId === productId)?.name ??
      "article";
    if (!fl) {
      throw new Error(
        `« ${name} » n’est pas sur le float — attribuez-le via Service stock.`,
      );
    }
    const rem = remainingFloat(fl) - (heldMap.get(productId) ?? 0);
    if (rem < qty) {
      throw new Error(
        `Float insuffisant pour « ${name} » (restant ${Math.max(0, rem)}). Demandez un réassort.`,
      );
    }
  }

  for (const [productId, qty] of needed) {
    const fl = floatLines.get(productId)!;
    await tx.serviceStockLine.update({
      where: { id: fl.id },
      data: { qtySold: fl.qtySold + qty },
    });
  }

  return session.id;
}
export async function restoreServiceFloatInTx(
  tx: Prisma.TransactionClient,
  branchId: string,
  lines: { menuItemId: string; quantity: number }[],
) {
  if (lines.length === 0) return null;
  const session = await tx.serviceStockSession.findFirst({
    where: {
      branchId,
      status: "OPEN",
      openingConfirmedAt: { not: null },
    },
    include: { lines: true },
  });
  if (!session) return null;

  const floatLines = new Map(
    session.lines
      .filter((l) => l.menuItemId)
      .map((l) => [l.menuItemId as string, l]),
  );
  const needed = new Map<string, number>();
  for (const line of lines) {
    needed.set(
      line.menuItemId,
      (needed.get(line.menuItemId) ?? 0) + Math.max(1, line.quantity),
    );
  }

  for (const [menuItemId, qty] of needed) {
    const fl = floatLines.get(menuItemId);
    if (!fl) continue;
    await tx.serviceStockLine.update({
      where: { id: fl.id },
      data: { qtySold: Math.max(0, fl.qtySold - qty) },
    });
  }

  return session.id;
}
