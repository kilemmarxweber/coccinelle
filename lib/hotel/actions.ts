"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { branchBasePath } from "@/lib/branch/paths";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/prisma/client";
import { DEFAULT_HOTEL_MENU } from "@/lib/hotel/default-menu";
import { HOTEL_CHECKOUT_HOUR } from "@/lib/hotel/constants";
import {
  defaultNeedsKitchen,
  isConsumableCategory,
  isHotelMenuCategory,
} from "@/lib/hotel/menu-categories";

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
  return { user: session.user, branch };
}

function revalidateHotel(organizationId: string, branchId: string) {
  const base = branchBasePath(organizationId, branchId);
  revalidatePath(`${base}/hotel/sejours`);
  revalidatePath(`${base}/hotel/chambres`);
  revalidatePath(`${base}/hotel/produits`);
  revalidatePath(`${base}/hotel/livraison`);
  revalidatePath(`${base}/hotel/restauration`);
  revalidatePath(`${base}/hotel/cuisine`);
  revalidatePath(`${base}/caisse`);
  revalidatePath(`${base}/rapports/tableau-bord`);
  revalidatePath(base);
}

function nightsBetween(checkIn: Date, checkOut: Date) {
  const ms = checkOut.getTime() - checkIn.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDateOnly(value: string | Date) {
  if (value instanceof Date) return startOfUtcDay(value);
  const [y, m, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, day ?? 1));
}

export async function listRoomsWithTypesAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.hotelRoom.findMany({
    where: { roomType: { branchId } },
    include: { roomType: true },
    orderBy: [{ roomType: { name: "asc" } }, { number: "asc" }],
  });
}

export async function updateRoomStatusAction(input: {
  organizationId: string;
  branchId: string;
  roomId: string;
  status: "AVAILABLE" | "OCCUPIED" | "CLEANING" | "OUT_OF_ORDER";
}) {
  await ctx(input.organizationId, input.branchId);
  const room = await prisma.hotelRoom.findFirst({
    where: { id: input.roomId, roomType: { branchId: input.branchId } },
  });
  if (!room) throw new Error("Chambre introuvable.");
  await prisma.hotelRoom.update({
    where: { id: room.id },
    data: { status: input.status },
  });
  revalidateHotel(input.organizationId, input.branchId);
}

export async function listStaysForMonthAction(
  organizationId: string,
  branchId: string,
  year: number,
  month: number,
) {
  await ctx(organizationId, branchId);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return prisma.hotelStay.findMany({
    where: {
      branchId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      checkInDate: { lt: end },
      checkOutDate: { gt: start },
    },
    include: {
      room: { include: { roomType: true } },
      folio: { include: { lines: true, payments: true } },
    },
    orderBy: { checkInDate: "asc" },
  });
}

export async function listStaysForYearAction(
  organizationId: string,
  branchId: string,
  year: number,
) {
  await ctx(organizationId, branchId);
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year + 1, 0, 1));
  return prisma.hotelStay.findMany({
    where: {
      branchId,
      status: { notIn: ["CANCELLED"] },
      checkInDate: { lt: end },
      checkOutDate: { gt: start },
    },
    select: {
      id: true,
      checkInDate: true,
      checkOutDate: true,
      status: true,
      roomId: true,
    },
  });
}

export async function createStayAction(input: {
  organizationId: string;
  branchId: string;
  roomId: string;
  guestName: string;
  guestPhone?: string;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  notes?: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const checkIn = parseDateOnly(input.checkInDate);
  const checkOut = parseDateOnly(input.checkOutDate);
  if (!(checkOut > checkIn)) throw new Error("Dates invalides.");

  const room = await prisma.hotelRoom.findFirst({
    where: { id: input.roomId, roomType: { branchId: input.branchId } },
    include: { roomType: true },
  });
  if (!room) throw new Error("Chambre introuvable.");

  const overlap = await prisma.hotelStay.findFirst({
    where: {
      roomId: room.id,
      status: { in: ["RESERVED", "CHECKED_IN"] },
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn },
    },
  });
  if (overlap) throw new Error("Chambre déjà réservée sur cette période.");

  const nights = nightsBetween(checkIn, checkOut);
  const nightAmount = nights * room.roomType.priceNight;

  const stay = await prisma.$transaction(async (tx) => {
    const s = await tx.hotelStay.create({
      data: {
        branchId: input.branchId,
        roomId: room.id,
        guestName: input.guestName.trim(),
        guestPhone: input.guestPhone?.trim() || null,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        adults: input.adults ?? 1,
        notes: input.notes ?? null,
        status: "RESERVED",
      },
    });
    await tx.folio.create({
      data: {
        branchId: input.branchId,
        stayId: s.id,
        label: `Séjour ${input.guestName.trim()}`,
        lines: {
          create: {
            kind: "NIGHT",
            description: `${nights} nuit(s) · ${room.roomType.name} ${room.number}`,
            quantity: nights,
            unitPrice: room.roomType.priceNight,
            amount: nightAmount,
          },
        },
      },
    });
    await tx.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: "Nouvelle réservation",
        body: `${input.guestName.trim()} · ch. ${room.number}`,
        kind: "stay_reserved",
        href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/sejours`,
      },
    });
    return s;
  });

  revalidateHotel(input.organizationId, input.branchId);
  return stay;
}

export async function checkInStayAction(input: {
  organizationId: string;
  branchId: string;
  stayId: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const stay = await prisma.hotelStay.findFirst({
    where: { id: input.stayId, branchId: input.branchId },
  });
  if (!stay) throw new Error("Séjour introuvable.");
  if (stay.status !== "RESERVED") throw new Error("Check-in impossible.");

  await prisma.$transaction([
    prisma.hotelStay.update({
      where: { id: stay.id },
      data: { status: "CHECKED_IN", checkedInAt: new Date() },
    }),
    prisma.hotelRoom.update({
      where: { id: stay.roomId },
      data: { status: "OCCUPIED" },
    }),
    prisma.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: "Check-in effectué",
        body: `${stay.guestName} vient d’arriver`,
        kind: "stay_checkin",
        href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/sejours`,
      },
    }),
  ]);
  revalidateHotel(input.organizationId, input.branchId);
}

export async function checkOutStayAction(input: {
  organizationId: string;
  branchId: string;
  stayId: string;
}) {
  await ctx(input.organizationId, input.branchId);
  // Applique d’abord toute nuitée retard (>10h) avant calcul du solde
  await applyLateCheckoutFeesAction(input.organizationId, input.branchId);

  const stay = await prisma.hotelStay.findFirst({
    where: { id: input.stayId, branchId: input.branchId },
    include: {
      folio: { include: { lines: true, payments: true } },
    },
  });
  if (!stay) throw new Error("Séjour introuvable.");
  if (stay.status !== "CHECKED_IN") throw new Error("Check-out impossible.");

  const charges = stay.folio?.lines.reduce((s, l) => s + l.amount, 0) ?? 0;
  const paid =
    stay.folio?.payments.reduce(
      (s, p) =>
        s +
        (p.amountForeign != null && p.amountForeign > 0
          ? p.amountForeign
          : p.amountCdf),
      0,
    ) ?? 0;
  const balance = charges - paid;
  if (balance > 0.01) {
    await prisma.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: "Check-out — solde à encaisser",
        body: `${stay.guestName} · solde ${balance.toFixed(2)} $`,
        kind: "stay_checkout_due",
        href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse`,
      },
    });
    return {
      ok: false as const,
      needsPayment: true,
      balance,
      folioId: stay.folio?.id ?? null,
    };
  }

  await prisma.$transaction([
    prisma.hotelStay.update({
      where: { id: stay.id },
      data: { status: "CHECKED_OUT", checkedOutAt: new Date() },
    }),
    prisma.hotelRoom.update({
      where: { id: stay.roomId },
      data: { status: "CLEANING" },
    }),
    ...(stay.folio
      ? [
          prisma.folio.update({
            where: { id: stay.folio.id },
            data: { closed: true },
          }),
        ]
      : []),
    prisma.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: "Check-out terminé",
        body: `${stay.guestName} a quitté l’établissement`,
        kind: "stay_checkout",
        href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/sejours`,
      },
    }),
  ]);
  revalidateHotel(input.organizationId, input.branchId);
  return { ok: true as const, needsPayment: false, balance: 0, folioId: null };
}

/**
 * Prolongation de séjour : décale la date de sortie et facture les nuitées ajoutées.
 */
export async function extendStayAction(input: {
  organizationId: string;
  branchId: string;
  stayId: string;
  newCheckOutDate: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const stay = await prisma.hotelStay.findFirst({
    where: { id: input.stayId, branchId: input.branchId },
    include: {
      room: { include: { roomType: true } },
      folio: { include: { lines: true } },
    },
  });
  if (!stay) throw new Error("Séjour introuvable.");
  if (stay.status !== "RESERVED" && stay.status !== "CHECKED_IN") {
    throw new Error("Séjour non prolongeable.");
  }

  const currentOut = parseDateOnly(stay.checkOutDate);
  const newOut = parseDateOnly(input.newCheckOutDate);
  if (!(newOut > currentOut)) {
    throw new Error("La nouvelle date de sortie doit être après la sortie actuelle.");
  }

  const overlap = await prisma.hotelStay.findFirst({
    where: {
      roomId: stay.roomId,
      id: { not: stay.id },
      status: { in: ["RESERVED", "CHECKED_IN"] },
      checkInDate: { lt: newOut },
      checkOutDate: { gt: currentOut },
    },
  });
  if (overlap) {
    throw new Error("Chambre déjà réservée sur la période de prolongation.");
  }

  const extraNights = nightsBetween(currentOut, newOut);
  const unit = stay.room.roomType.priceNight;
  const amount = extraNights * unit;

  await prisma.$transaction(async (tx) => {
    await tx.hotelStay.update({
      where: { id: stay.id },
      data: { checkOutDate: newOut },
    });
    if (stay.folio) {
      await tx.folioLine.create({
        data: {
          folioId: stay.folio.id,
          kind: "NIGHT",
          description: `Prolongation · ${extraNights} nuit(s) · ch. ${stay.room.number}`,
          quantity: extraNights,
          unitPrice: unit,
          amount,
        },
      });
      await tx.folio.update({
        where: { id: stay.folio.id },
        data: { closed: false },
      });
    }
    await tx.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: "Séjour prolongé",
        body: `${stay.guestName} · +${extraNights} nuit(s) · ch. ${stay.room.number}`,
        kind: "stay_extended",
        href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/sejours`,
      },
    });
  });

  revalidateHotel(input.organizationId, input.branchId);
  return { extraNights, amount, newCheckOutDate: newOut.toISOString().slice(0, 10) };
}

/**
 * Si le client est encore présent après 10h le jour de checkout,
 * facture une nuitée supplémentaire et décale la sortie d’un jour.
 */
export async function applyLateCheckoutFeesAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  const now = new Date();
  if (now.getHours() < HOTEL_CHECKOUT_HOUR) {
    return { charged: 0 };
  }

  const today = startOfUtcDay(
    new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())),
  );
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const stays = await prisma.hotelStay.findMany({
    where: {
      branchId,
      status: "CHECKED_IN",
      checkOutDate: { lte: today },
    },
    include: {
      room: { include: { roomType: true } },
      folio: { include: { lines: true } },
    },
  });

  let charged = 0;
  for (const stay of stays) {
    if (!stay.folio) continue;
    const marker = `Retard checkout >${HOTEL_CHECKOUT_HOUR}h · ${today.toISOString().slice(0, 10)}`;
    const already = stay.folio.lines.some((l) => l.description.includes(marker));
    if (already) continue;

    const unit = stay.room.roomType.priceNight;
    const newOut =
      parseDateOnly(stay.checkOutDate) < tomorrow
        ? tomorrow
        : new Date(parseDateOnly(stay.checkOutDate).getTime() + 86400000);

    // Évite conflit si une autre résa commence demain
    const overlap = await prisma.hotelStay.findFirst({
      where: {
        roomId: stay.roomId,
        id: { not: stay.id },
        status: { in: ["RESERVED", "CHECKED_IN"] },
        checkInDate: { lt: newOut },
        checkOutDate: { gt: parseDateOnly(stay.checkOutDate) },
      },
    });
    if (overlap) {
      // Facture quand même la nuitée retard sans décaler si conflit — description seule
      await prisma.folioLine.create({
        data: {
          folioId: stay.folio.id,
          kind: "NIGHT",
          description: `${marker} · ch. ${stay.room.number} (sans prolongation — conflit résa)`,
          quantity: 1,
          unitPrice: unit,
          amount: unit,
        },
      });
    } else {
      await prisma.$transaction([
        prisma.hotelStay.update({
          where: { id: stay.id },
          data: { checkOutDate: newOut },
        }),
        prisma.folioLine.create({
          data: {
            folioId: stay.folio.id,
            kind: "NIGHT",
            description: `${marker} · ch. ${stay.room.number}`,
            quantity: 1,
            unitPrice: unit,
            amount: unit,
          },
        }),
        prisma.folio.update({
          where: { id: stay.folio.id },
          data: { closed: false },
        }),
        prisma.branchNotification.create({
          data: {
            branchId,
            title: "Nuitée retard checkout",
            body: `${stay.guestName} · ch. ${stay.room.number} · +1 nuit (${unit.toFixed(2)} $)`,
            kind: "stay_late_checkout",
            href: `/admin/organizations/${organizationId}/branches/${branchId}/caisse`,
          },
        }),
      ]);
    }
    charged += 1;
  }

  if (charged > 0) revalidateHotel(organizationId, branchId);
  return { charged };
}

export async function listMenuItemsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.hotelMenuItem.findMany({
    where: { branchId, active: true, isConsumable: false },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

/** Catalogue admin (actifs + inactifs) pour la page Produits. */
export async function listAllMenuItemsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.hotelMenuItem.findMany({
    where: { branchId },
    orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
  });
}

/** Consommables actifs pour la page Livraison. */
export async function listConsumableItemsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.hotelMenuItem.findMany({
    where: { branchId, isConsumable: true, active: true },
    orderBy: [{ name: "asc" }],
  });
}

export async function listStockMovementsAction(
  organizationId: string,
  branchId: string,
  opts?: {
    kind?: "ENTREE" | "SORTIE" | "ALL";
    from?: string | null;
    to?: string | null;
    limit?: number;
  },
) {
  await ctx(organizationId, branchId);
  const kind = opts?.kind ?? "ALL";
  const limit = Math.min(500, Math.max(1, opts?.limit ?? 100));

  const createdAt: { gte?: Date; lte?: Date } = {};
  if (opts?.from) {
    const [y, m, d] = opts.from.slice(0, 10).split("-").map(Number);
    createdAt.gte = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
  }
  if (opts?.to) {
    const [y, m, d] = opts.to.slice(0, 10).split("-").map(Number);
    createdAt.lte = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1, 23, 59, 59, 999));
  }

  const rows = await prisma.hotelStockMovement.findMany({
    where: {
      branchId,
      ...(kind === "ENTREE" || kind === "SORTIE" ? { kind } : {}),
      ...(createdAt.gte || createdAt.lte ? { createdAt } : {}),
    },
    include: {
      menuItem: {
        select: {
          id: true,
          name: true,
          imageUrl: true,
          stockQty: true,
          supplierName: true,
          provenance: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return enrichMovementStocks(branchId, rows);
}

/**
 * Recalcule stock avant / reste à partir du stock actuel du produit
 * en rejouant tous les mouvements (du plus récent au plus ancien).
 * Corrige les anciennes lignes restées à 0/0.
 */
async function enrichMovementStocks<
  T extends {
    id: string;
    menuItemId: string;
    kind: string;
    quantity: number;
    stockBefore: number;
    stockAfter: number;
  },
>(branchId: string, rows: T[]): Promise<T[]> {
  if (rows.length === 0) return rows;

  const itemIds = [...new Set(rows.map((r) => r.menuItemId))];
  const [items, allMoves] = await Promise.all([
    prisma.hotelMenuItem.findMany({
      where: { branchId, id: { in: itemIds } },
      select: { id: true, stockQty: true },
    }),
    prisma.hotelStockMovement.findMany({
      where: { branchId, menuItemId: { in: itemIds } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        menuItemId: true,
        kind: true,
        quantity: true,
      },
    }),
  ]);

  const running = new Map(items.map((i) => [i.id, i.stockQty]));
  const computed = new Map<string, { stockBefore: number; stockAfter: number }>();

  for (const m of allMoves) {
    const after = running.get(m.menuItemId) ?? 0;
    const before =
      m.kind === "ENTREE" ? after - m.quantity : after + m.quantity;
    computed.set(m.id, {
      stockBefore: Math.max(0, before),
      stockAfter: Math.max(0, after),
    });
    running.set(m.menuItemId, before);
  }

  return rows.map((row) => {
    const c = computed.get(row.id);
    if (!c) return row;
    return {
      ...row,
      stockBefore: c.stockBefore,
      stockAfter: c.stockAfter,
    };
  });
}

const MAX_PRODUCT_IMAGE_CHARS = 700_000; // ~512 Ko data URL

function normalizeProductImage(imageUrl?: string | null) {
  const v = imageUrl?.trim() || null;
  if (!v) return null;
  if (v.length > MAX_PRODUCT_IMAGE_CHARS) {
    throw new Error("Image trop volumineuse (max. 512 Ko).");
  }
  if (!v.startsWith("data:image/") && !v.startsWith("https://") && !v.startsWith("http://")) {
    throw new Error("Format d’image invalide.");
  }
  return v;
}

function normalizeCategory(category: string) {
  const c = category.trim();
  if (!isHotelMenuCategory(c)) {
    throw new Error("Type de produit invalide.");
  }
  return c;
}

function normalizeOptionalText(value?: string | null, max = 120) {
  const v = value?.trim() || null;
  if (!v) return null;
  if (v.length > max) throw new Error("Texte trop long.");
  return v;
}

export async function createMenuItemAction(input: {
  organizationId: string;
  branchId: string;
  name: string;
  category: string;
  price?: number | null;
  stockQty: number;
  needsKitchen?: boolean;
  imageUrl?: string | null;
  provenance?: string | null;
  supplierName?: string | null;
}) {
  await ctx(input.organizationId, input.branchId);
  const name = input.name.trim();
  if (!name) throw new Error("Nom du produit requis.");
  const category = normalizeCategory(input.category);
  const isConsumable = isConsumableCategory(category);
  let price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) {
    if (isConsumable) price = 0;
    else throw new Error("Prix invalide.");
  }
  if (!isConsumable && (!(price > 0) && price !== 0)) {
    // allow 0 for freebies? keep >= 0 already
  }
  const stockQty = Math.max(0, Math.round(Number(input.stockQty) || 0));
  const needsKitchen = isConsumable
    ? false
    : (input.needsKitchen ?? defaultNeedsKitchen(category));

  const item = await prisma.hotelMenuItem.create({
    data: {
      branchId: input.branchId,
      name,
      category,
      price,
      stockQty,
      needsKitchen,
      isConsumable,
      provenance: isConsumable
        ? normalizeOptionalText(input.provenance)
        : null,
      supplierName: isConsumable
        ? normalizeOptionalText(input.supplierName)
        : null,
      imageUrl: normalizeProductImage(input.imageUrl),
      active: true,
    },
  });
  revalidateHotel(input.organizationId, input.branchId);
  return item;
}

export async function updateMenuItemAction(input: {
  organizationId: string;
  branchId: string;
  itemId: string;
  name: string;
  category: string;
  price?: number | null;
  stockQty: number;
  needsKitchen: boolean;
  active: boolean;
  imageUrl?: string | null;
  provenance?: string | null;
  supplierName?: string | null;
}) {
  await ctx(input.organizationId, input.branchId);
  const existing = await prisma.hotelMenuItem.findFirst({
    where: { id: input.itemId, branchId: input.branchId },
  });
  if (!existing) throw new Error("Produit introuvable.");

  const name = input.name.trim();
  if (!name) throw new Error("Nom du produit requis.");
  const category = normalizeCategory(input.category);
  const isConsumable = isConsumableCategory(category);
  let price = Number(input.price);
  if (!Number.isFinite(price) || price < 0) {
    if (isConsumable) price = 0;
    else throw new Error("Prix invalide.");
  }
  const stockQty = Math.max(0, Math.round(Number(input.stockQty) || 0));

  const item = await prisma.hotelMenuItem.update({
    where: { id: existing.id },
    data: {
      name,
      category,
      price,
      stockQty,
      needsKitchen: isConsumable ? false : Boolean(input.needsKitchen),
      isConsumable,
      provenance: isConsumable
        ? normalizeOptionalText(input.provenance)
        : null,
      supplierName: isConsumable
        ? normalizeOptionalText(input.supplierName)
        : null,
      active: Boolean(input.active),
      imageUrl: normalizeProductImage(input.imageUrl),
    },
  });
  revalidateHotel(input.organizationId, input.branchId);
  return item;
}

export async function setMenuItemStockAction(input: {
  organizationId: string;
  branchId: string;
  itemId: string;
  stockQty: number;
}) {
  await ctx(input.organizationId, input.branchId);
  const stockQty = Math.max(0, Math.round(Number(input.stockQty) || 0));
  const existing = await prisma.hotelMenuItem.findFirst({
    where: { id: input.itemId, branchId: input.branchId },
  });
  if (!existing) throw new Error("Produit introuvable.");
  const item = await prisma.hotelMenuItem.update({
    where: { id: existing.id },
    data: { stockQty },
  });
  revalidateHotel(input.organizationId, input.branchId);
  return item;
}

/** Entrée (livraison) ou sortie (décompte) pour un consommable. */
export async function recordConsumableStockMoveAction(input: {
  organizationId: string;
  branchId: string;
  itemId: string;
  kind: "ENTREE" | "SORTIE";
  quantity: number;
  note?: string | null;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const qty = Math.round(Number(input.quantity));
  if (!Number.isFinite(qty) || qty < 1) {
    throw new Error("Quantité invalide (min. 1).");
  }
  if (input.kind !== "ENTREE" && input.kind !== "SORTIE") {
    throw new Error("Type de mouvement invalide.");
  }

  const item = await prisma.hotelMenuItem.findFirst({
    where: {
      id: input.itemId,
      branchId: input.branchId,
      isConsumable: true,
      active: true,
    },
  });
  if (!item) throw new Error("Consommable introuvable.");

  if (input.kind === "SORTIE" && item.stockQty < qty) {
    throw new Error(
      `Stock insuffisant pour « ${item.name} » (dispo ${item.stockQty}).`,
    );
  }

  const note = normalizeOptionalText(input.note, 200);
  const stockBefore = item.stockQty;
  const stockAfter =
    input.kind === "ENTREE" ? stockBefore + qty : stockBefore - qty;

  await prisma.$transaction(async (tx) => {
    await tx.hotelMenuItem.update({
      where: { id: item.id },
      data: { stockQty: stockAfter },
    });
    await tx.hotelStockMovement.create({
      data: {
        branchId: input.branchId,
        menuItemId: item.id,
        kind: input.kind,
        quantity: qty,
        stockBefore,
        stockAfter,
        note,
        createdByUserId: user.id,
      },
    });
  });

  revalidateHotel(input.organizationId, input.branchId);
  return { ok: true as const };
}

async function consumeMenuStock(
  tx: Prisma.TransactionClient,
  branchId: string,
  lines: { menuItemId: string; quantity: number }[],
) {
  const ids = [...new Set(lines.map((l) => l.menuItemId))];
  const rows = await tx.hotelMenuItem.findMany({
    where: {
      branchId,
      id: { in: ids },
      active: true,
      isConsumable: false,
    },
    select: { id: true, name: true, stockQty: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const needed = new Map<string, number>();
  for (const line of lines) {
    if (!byId.has(line.menuItemId)) {
      throw new Error("Article invalide.");
    }
    needed.set(
      line.menuItemId,
      (needed.get(line.menuItemId) ?? 0) + Math.max(1, line.quantity),
    );
  }
  for (const [id, qty] of needed) {
    const row = byId.get(id)!;
    if (row.stockQty < qty) {
      throw new Error(
        `Stock insuffisant pour « ${row.name} » (dispo ${row.stockQty}).`,
      );
    }
  }
  for (const [id, qty] of needed) {
    await tx.hotelMenuItem.update({
      where: { id },
      data: { stockQty: { decrement: qty } },
    });
  }
}

export async function ensureHotelMenuSeedAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  const existing = await prisma.hotelMenuItem.findMany({
    where: { branchId },
    select: { id: true, name: true, needsKitchen: true, category: true },
  });
  const known = new Set(existing.map((e) => e.name));
  const missing = DEFAULT_HOTEL_MENU.filter((item) => !known.has(item.name));
  if (missing.length > 0) {
    await prisma.hotelMenuItem.createMany({
      data: missing.map((item) => ({
        branchId,
        ...item,
        stockQty: 50,
      })),
    });
  }
  // Aligne desserts / articles seed sur needsKitchen (ex. desserts → cuisine)
  const byName = new Map<string, (typeof DEFAULT_HOTEL_MENU)[number]>(
    DEFAULT_HOTEL_MENU.map((i) => [i.name, i]),
  );
  for (const row of existing) {
    const def = byName.get(row.name);
    if (!def) continue;
    if (row.needsKitchen !== def.needsKitchen || row.category !== def.category) {
      await prisma.hotelMenuItem.update({
        where: { id: row.id },
        data: {
          needsKitchen: def.needsKitchen,
          category: def.category,
        },
      });
    }
  }
  // Tout dessert hors seed → cuisine
  await prisma.hotelMenuItem.updateMany({
    where: {
      branchId,
      category: { equals: "Desserts", mode: "insensitive" },
      needsKitchen: false,
    },
    data: { needsKitchen: true },
  });
  const rate = await prisma.exchangeRate.count({ where: { branchId } });
  if (rate === 0) {
    await prisma.exchangeRate.create({
      data: {
        branchId,
        fromCurrency: "USD",
        toCurrency: "CDF",
        rate: 2850,
      },
    });
  }
  // Pas de revalidatePath : appelé pendant le render des pages (caisse / restauration).
}

export async function createHotelOrderAction(input: {
  organizationId: string;
  branchId: string;
  tableLabel?: string;
  stayId?: string;
  items: { menuItemId: string; quantity: number }[];
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  if (!input.items.length) throw new Error("Ajoutez au moins un article.");

  const menuIds = input.items.map((i) => i.menuItemId);
  const menu = await prisma.hotelMenuItem.findMany({
    where: {
      branchId: input.branchId,
      id: { in: menuIds },
      active: true,
      isConsumable: false,
    },
  });
  if (menu.length !== menuIds.length) throw new Error("Article invalide.");

  const byId = new Map(menu.map((m) => [m.id, m]));
  const needsKitchen = menu.some((m) => m.needsKitchen);

  const order = await prisma.$transaction(async (tx) => {
    await consumeMenuStock(tx, input.branchId, input.items);

    const o = await tx.hotelOrder.create({
      data: {
        branchId: input.branchId,
        stayId: input.stayId ?? null,
        tableLabel: input.tableLabel?.trim() || null,
        status: needsKitchen ? "ENVOYEE" : "PRETE",
        createdByUserId: user.id,
        sentAt: new Date(),
        readyAt: needsKitchen ? null : new Date(),
        items: {
          create: input.items.map((i) => {
            const m = byId.get(i.menuItemId)!;
            const qty = Math.max(1, i.quantity);
            return {
              menuItemId: m.id,
              name: m.name,
              quantity: qty,
              unitPrice: m.price,
              amount: m.price * qty,
              needsKitchen: m.needsKitchen,
            };
          }),
        },
      },
      include: { items: true },
    });

    await tx.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: needsKitchen ? "Nouvelle commande cuisine" : "Commande prête caisse",
        body: `${o.tableLabel ?? "Salle"} · ${o.items.length} article(s)`,
        kind: needsKitchen ? "order_sent" : "order_ready",
        href: needsKitchen
          ? `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/cuisine?orderId=${o.id}`
          : `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse?orderId=${o.id}`,
      },
    });

    return o;
  });

  revalidateHotel(input.organizationId, input.branchId);
  return order;
}

export async function advanceHotelOrderAction(input: {
  organizationId: string;
  branchId: string;
  orderId: string;
  to:
    | "EN_PREPARATION"
    | "PRETE"
    | "EN_CAISSE"
    | "LIVREE"
    | "ANNULEE";
  /** Minutes estimées — obligatoire pour démarrer la préparation. */
  estimatedMinutes?: number;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const order = await prisma.hotelOrder.findFirst({
    where: { id: input.orderId, branchId: input.branchId },
  });
  if (!order) throw new Error("Commande introuvable.");

  if (input.to === "EN_PREPARATION") {
    const mins = Math.round(Number(input.estimatedMinutes));
    if (!Number.isFinite(mins) || mins < 1 || mins > 180) {
      throw new Error("Indiquez un temps estimé entre 1 et 180 minutes.");
    }
  }

  const data: {
    status: typeof input.to;
    readyAt?: Date;
    deliveredAt?: Date;
    prepStartedAt?: Date;
    estimatedMinutes?: number;
    preparedByUserId?: string;
  } = { status: input.to };

  if (input.to === "EN_PREPARATION") {
    data.prepStartedAt = new Date();
    data.estimatedMinutes = Math.round(Number(input.estimatedMinutes));
    data.preparedByUserId = user.id;
  }
  if (input.to === "PRETE") {
    data.readyAt = new Date();
    if (!order.preparedByUserId) data.preparedByUserId = user.id;
  }
  if (input.to === "LIVREE") data.deliveredAt = new Date();

  await prisma.$transaction(async (tx) => {
    // Livrer sans paiement : sort resto + cuisine, reste en file caisse
    if (input.to === "LIVREE") {
      const alreadyPaid =
        order.status === "PAYEE" || order.paidAt != null;
      const wasInKitchen =
        order.status === "ENVOYEE" || order.status === "EN_PREPARATION";

      if (!alreadyPaid) {
        await tx.hotelOrder.update({
          where: { id: order.id },
          data: {
            status: "EN_CAISSE",
            deliveredAt: new Date(),
            readyAt: order.readyAt ?? new Date(),
          },
        });
        await tx.branchNotification.updateMany({
          where: {
            branchId: input.branchId,
            readAt: null,
            OR: [
              { href: { contains: `orderId=${order.id}` } },
              { body: { contains: order.id.slice(0, 8) } },
            ],
          },
          data: { readAt: new Date() },
        });
        if (wasInKitchen) {
          await tx.branchNotification.create({
            data: {
              branchId: input.branchId,
              title: "Cuisine — ticket retiré",
              body: `${order.tableLabel ?? "Salle"} · livrée, en attente d’encaissement`,
              kind: "order_kitchen_bypassed",
              href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/cuisine`,
            },
          });
        }
        await tx.branchNotification.create({
          data: {
            branchId: input.branchId,
            title: "À encaisser",
            body: `${order.tableLabel ?? "Salle"} · déjà livrée — encaisser & reçu`,
            kind: "order_awaiting_payment",
            href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse?orderId=${order.id}`,
          },
        });
        return;
      }

      await tx.hotelOrder.update({
        where: { id: order.id },
        data: { status: "LIVREE", deliveredAt: new Date() },
      });
      await tx.branchNotification.updateMany({
        where: {
          branchId: input.branchId,
          readAt: null,
          OR: [
            { href: { contains: `orderId=${order.id}` } },
            { body: { contains: order.id.slice(0, 8) } },
            ...(order.tableLabel
              ? [
                  {
                    kind: "order_paid" as const,
                    body: { contains: order.tableLabel },
                  },
                ]
              : []),
          ],
        },
        data: { readAt: new Date() },
      });
      return;
    }

    await tx.hotelOrder.update({ where: { id: order.id }, data });

    const href =
      input.to === "PRETE" || input.to === "EN_CAISSE"
        ? `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse?orderId=${order.id}`
        : `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/restauration?view=suivi&orderId=${order.id}`;

    const estimateHint =
      input.to === "EN_PREPARATION" && data.estimatedMinutes
        ? ` · ~${data.estimatedMinutes} min`
        : "";

    await tx.branchNotification.create({
      data: {
        branchId: input.branchId,
        title:
          input.to === "EN_PREPARATION"
            ? "Cuisine — en préparation"
            : `Commande ${input.to}`,
        body: `${order.tableLabel ?? "Salle"} · ${order.id.slice(0, 8)}… → ${input.to}${estimateHint}`,
        kind: `order_${input.to.toLowerCase()}`,
        href,
      },
    });
  });

  revalidateHotel(input.organizationId, input.branchId);
}

export async function listOrdersByStatusAction(
  organizationId: string,
  branchId: string,
  statuses: Array<
    | "BROUILLON"
    | "ENVOYEE"
    | "EN_PREPARATION"
    | "PRETE"
    | "EN_CAISSE"
    | "PAYEE"
    | "LIVREE"
    | "ANNULEE"
  >,
) {
  await ctx(organizationId, branchId);
  return prisma.hotelOrder.findMany({
    where: { branchId, status: { in: statuses } },
    include: {
      items: true,
      stay: { include: { room: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });
}

export async function listNotificationsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.branchNotification.findMany({
    where: { branchId },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
}

export async function markNotificationsReadAction(
  organizationId: string,
  branchId: string,
  ids?: string[],
) {
  await ctx(organizationId, branchId);
  await prisma.branchNotification.updateMany({
    where: {
      branchId,
      readAt: null,
      ...(ids?.length ? { id: { in: ids } } : {}),
    },
    data: { readAt: new Date() },
  });
}

export async function getBranchAlertFeedAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  // Jour calendaire local → bornes UTC (colonnes @db.Date)
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);

  const [
    rawNotifications,
    kitchenOrders,
    readyOrders,
    toDeliver,
    arrivals,
    departures,
    deliveredOrders,
  ] = await Promise.all([
    prisma.branchNotification.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.hotelOrder.count({
      where: {
        branchId,
        status: { in: ["ENVOYEE", "EN_PREPARATION"] },
      },
    }),
    prisma.hotelOrder.count({
      where: { branchId, status: { in: ["PRETE", "EN_CAISSE"] } },
    }),
    prisma.hotelOrder.count({
      where: { branchId, status: "PAYEE" },
    }),
    // Arrivées : check-in dû (réservé ≤ aujourd’hui) + déjà arrivés aujourd’hui
    prisma.hotelStay.count({
      where: {
        branchId,
        OR: [
          {
            status: "RESERVED",
            checkInDate: { lt: end },
          },
          {
            status: "CHECKED_IN",
            checkInDate: { gte: start, lt: end },
          },
        ],
      },
    }),
    // Départs dus : checkout prévu aujourd’hui ou en retard, encore en chambre
    prisma.hotelStay.count({
      where: {
        branchId,
        status: "CHECKED_IN",
        checkOutDate: { lt: end },
      },
    }),
    prisma.hotelOrder.findMany({
      where: { branchId, status: "LIVREE" },
      select: { id: true, tableLabel: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const deliveredIds = new Set(deliveredOrders.map((o) => o.id));
  const deliveredTables = new Set(
    deliveredOrders
      .map((o) => o.tableLabel)
      .filter((t): t is string => Boolean(t)),
  );

  const notifications = rawNotifications.filter((n) => {
    const kind = n.kind.toLowerCase();
    // Ne plus afficher les notifs de livraison / commandes déjà livrées
    if (kind === "order_livree" || kind.endsWith("_livree")) return false;

    const fromHref = n.href?.match(/orderId=([0-9a-f-]{8,})/i)?.[1];
    if (fromHref && deliveredIds.has(fromHref)) return false;

    for (const id of deliveredIds) {
      if (n.href?.includes(id) || n.body.includes(id.slice(0, 8))) return false;
    }

    // « À livrer » : masquer s’il n’y a plus de commandes PAYEE,
    // ou si la notif pointe une table déjà livrée sans orderId.
    if (kind === "order_paid") {
      if (toDeliver === 0) return false;
      if (
        n.body.includes("À livrer") &&
        [...deliveredTables].some((t) => n.body.includes(t)) &&
        !fromHref
      ) {
        return false;
      }
    }

    return true;
  }).slice(0, 25);

  const unreadCount = notifications.filter((n) => !n.readAt).length;
  const fnbPending = readyOrders + toDeliver;
  const attention =
    kitchenOrders + fnbPending + arrivals + departures + unreadCount;

  return {
    notifications,
    unreadCount,
    attention,
    ops: {
      kitchenOrders,
      readyOrders: fnbPending,
      toDeliver,
      arrivals,
      departures,
    },
  };
}

export async function getHotelDashboardKpisAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const rooms = await prisma.hotelRoom.count({
    where: { roomType: { branchId } },
  });
  const occupied = await prisma.hotelStay.count({
    where: { branchId, status: "CHECKED_IN" },
  });
  const payments = await prisma.payment.findMany({
    where: { branchId, paidAt: { gte: start } },
    select: { amountCdf: true, amountForeign: true },
  });
  const caJourUsd = payments.reduce(
    (s, p) =>
      s +
      (p.amountForeign != null && p.amountForeign > 0
        ? p.amountForeign
        : p.amountCdf),
    0,
  );
  const fnbTickets = await prisma.hotelOrder.count({
    where: { branchId, paidAt: { gte: start }, status: { in: ["PAYEE", "LIVREE"] } },
  });
  return {
    rooms,
    occupied,
    occupancyPct: rooms ? Math.round((occupied / rooms) * 100) : 0,
    caJour: caJourUsd,
    paiementsJour: payments.length,
    ticketsFnbJour: fnbTickets,
  };
}

/**
 * Vente rapide caisse → file F&B « en cours » (pas cuisine, pas « prêt »).
 * Le caissier encaisse et/ou livre lui-même.
 */
export async function createQuickSaleAction(input: {
  organizationId: string;
  branchId: string;
  items: { menuItemId: string; quantity: number }[];
  tableLabel?: string;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  if (!input.items.length) throw new Error("Panier vide.");

  const menuIds = input.items.map((i) => i.menuItemId);
  const menu = await prisma.hotelMenuItem.findMany({
    where: {
      branchId: input.branchId,
      id: { in: menuIds },
      active: true,
      isConsumable: false,
    },
  });
  if (menu.length !== menuIds.length) throw new Error("Article invalide.");

  const byId = new Map(menu.map((m) => [m.id, m]));
  const label = input.tableLabel?.trim() || "Vente rapide";
  const now = new Date();

  const order = await prisma.$transaction(async (tx) => {
    await consumeMenuStock(tx, input.branchId, input.items);

    const o = await tx.hotelOrder.create({
      data: {
        branchId: input.branchId,
        tableLabel: label,
        status: "EN_CAISSE",
        createdByUserId: user.id,
        sentAt: now,
        readyAt: now,
        items: {
          create: input.items.map((i) => {
            const m = byId.get(i.menuItemId)!;
            const qty = Math.max(1, i.quantity);
            return {
              menuItemId: m.id,
              name: m.name,
              quantity: qty,
              unitPrice: m.price,
              amount: m.price * qty,
              needsKitchen: false,
            };
          }),
        },
      },
      include: { items: true },
    });

    await tx.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: "Vente rapide — en cours caisse",
        body: `${label} · ${o.items.length} article(s)`,
        kind: "order_en_caisse",
        href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse?orderId=${o.id}`,
      },
    });

    return o;
  });

  revalidateHotel(input.organizationId, input.branchId);
  return order;
}
