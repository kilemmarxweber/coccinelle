"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { assertHospitalityModule } from "@/lib/branch/hospitality";
import { branchBasePath, hotelRoutes } from "@/lib/branch/paths";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/prisma/client";

export type StorageZone = "MAGASIN" | "CONGELATEUR";

function normalizeZone(value: string | null | undefined): StorageZone {
  return value?.toUpperCase() === "CONGELATEUR" ? "CONGELATEUR" : "MAGASIN";
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
  assertHospitalityModule(branch, "restaurant");
  return { user: session.user, branch };
}

function revalidateServiceStock(organizationId: string, branchId: string) {
  const base = branchBasePath(organizationId, branchId);
  revalidatePath(base);
  revalidatePath(hotelRoutes.serviceStock(organizationId, branchId));
  revalidatePath(hotelRoutes.restauration(organizationId, branchId));
  revalidatePath(hotelRoutes.produits(organizationId, branchId));
  revalidatePath(`${base}/caisse`);
}

async function nextSessionNumber(branchId: string) {
  const count = await prisma.serviceStockSession.count({ where: { branchId } });
  return `SS-${String(count + 1).padStart(5, "0")}`;
}

function remainingFloat(line: {
  qtyAttributed: number;
  qtySold: number;
  qtyLoss: number;
}) {
  return Math.max(0, line.qtyAttributed - line.qtySold - line.qtyLoss);
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
  await ctx(organizationId, branchId);
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
  await ctx(organizationId, branchId);
  return prisma.serviceStockSession.findFirst({
    where: {
      branchId,
      status: { in: ["DRAFT", "OPEN", "CLOSING"] },
    },
    include: {
      lines: {
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
        },
        orderBy: { createdAt: "asc" },
      },
      topUps: {
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
    orderBy: { openedAt: "desc" },
  });
}

/** Snapshot float pour POS / resto (gate + stock restant). */
export async function getServiceStockGateAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  const session = await prisma.serviceStockSession.findFirst({
    where: { branchId, status: "OPEN", openingConfirmedAt: { not: null } },
    include: {
      lines: {
        select: {
          menuItemId: true,
          qtyAttributed: true,
          qtySold: true,
          qtyLoss: true,
          unitPriceUsd: true,
          menuItem: { select: { name: true, needsKitchen: true } },
        },
      },
    },
    orderBy: { openedAt: "desc" },
  });
  if (!session) {
    return {
      ready: false as const,
      session: null,
      floatByItemId: {} as Record<string, number>,
    };
  }
  const floatByItemId: Record<string, number> = {};
  for (const line of session.lines) {
    floatByItemId[line.menuItemId] = remainingFloat(line);
  }
  return {
    ready: true as const,
    session: {
      id: session.id,
      number: session.number,
      vendorDisplayName: session.vendorDisplayName,
      openedAt: session.openedAt,
      openingConfirmedAt: session.openingConfirmedAt,
    },
    floatByItemId,
  };
}

export async function listServiceStockSessionsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.serviceStockSession.findMany({
    where: { branchId },
    orderBy: { openedAt: "desc" },
    take: 30,
    include: {
      lines: { select: { qtyAttributed: true, qtySold: true, unitPriceUsd: true } },
    },
  });
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
  notes?: string | null;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
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
      `Une session stock est déjà active (${open.number}). Clôturez-la d’abord.`,
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

  const cleaned = input.lines
    .map((l) => ({
      menuItemId: l.menuItemId,
      quantity: Math.max(0, Math.round(Number(l.quantity) || 0)),
      sourceZone: normalizeZone(l.sourceZone),
    }))
    .filter((l) => l.quantity > 0);
  if (cleaned.length === 0) {
    throw new Error("Attribuez au moins un produit hors cuisine.");
  }

  const ids = [...new Set(cleaned.map((l) => l.menuItemId))];
  const items = await prisma.hotelMenuItem.findMany({
    where: {
      branchId: input.branchId,
      id: { in: ids },
      active: true,
      isConsumable: false,
      needsKitchen: false,
    },
  });
  if (items.length !== ids.length) {
    throw new Error(
      "Un ou plusieurs articles sont invalides (hors cuisine / actifs uniquement).",
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

  const session = await prisma.$transaction(async (tx) => {
    const created = await tx.serviceStockSession.create({
      data: {
        branchId: input.branchId,
        number,
        status: "DRAFT",
        vendorUserId,
        vendorDisplayName,
        openedByUserId: user.id,
        notes: input.notes?.trim() || null,
      },
    });

    for (const line of cleaned) {
      const item = byId.get(line.menuItemId)!;
      const stockBefore = item.stockQty;
      const stockAfter = stockBefore - line.quantity;
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
      await tx.serviceStockLine.create({
        data: {
          sessionId: created.id,
          menuItemId: item.id,
          qtyAttributed: line.quantity,
          unitPriceUsd: item.price,
          sourceZone: line.sourceZone || normalizeZone(item.storageZone),
        },
      });
      item.stockQty = stockAfter;
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
  const session = await prisma.serviceStockSession.findFirst({
    where: {
      id: input.sessionId,
      branchId: input.branchId,
      status: { in: ["DRAFT", "OPEN"] },
    },
    include: { lines: true },
  });
  if (!session) throw new Error("Session introuvable.");
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
  const { user } = await ctx(input.organizationId, input.branchId);
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

  const item = await prisma.hotelMenuItem.findFirst({
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
  });

  revalidateServiceStock(input.organizationId, input.branchId);
  return { ok: true };
}

export async function closeServiceStockSessionAction(input: {
  organizationId: string;
  branchId: string;
  sessionId: string;
  counts: {
    lineId: string;
    qtyClosingCounted: number;
    qtyLoss?: number;
  }[];
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const session = await prisma.serviceStockSession.findFirst({
    where: {
      id: input.sessionId,
      branchId: input.branchId,
      status: "OPEN",
      openingConfirmedAt: { not: null },
    },
    include: { lines: { include: { menuItem: true } } },
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
      // Retour dépôt = min(compté, théorique) pour éviter de recréer du stock fantôme
      const toReturn = Math.min(c.qtyClosingCounted, theoretical);
      if (toReturn > 0) {
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
      }
      await tx.serviceStockLine.update({
        where: { id: line.id },
        data: {
          qtyClosingCounted: c.qtyClosingCounted,
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
      },
    });
  });

  revalidateServiceStock(input.organizationId, input.branchId);
  return { ok: true };
}

/** Décrémente le float (hors cuisine) dans une transaction vente/commande. */
export async function consumeServiceFloatInTx(
  tx: Prisma.TransactionClient,
  branchId: string,
  lines: { menuItemId: string; quantity: number }[],
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
      "Ouvrez et confirmez le service stock (état des lieux) avant de vendre hors cuisine.",
    );
  }

  const floatLines = new Map(
    session.lines.map((l) => [l.menuItemId, l]),
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
    if (!fl || fl.menuItem.needsKitchen) {
      throw new Error(
        "Article hors float service — attribuez-le via Service stock ou utilisez un produit cuisine.",
      );
    }
    const rem = remainingFloat(fl);
    if (rem < qty) {
      throw new Error(
        `Float insuffisant pour « ${fl.menuItem.name} » (restant ${rem}). Demandez un réassort.`,
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
