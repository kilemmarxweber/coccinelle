"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { branchBasePath } from "@/lib/branch/paths";
import prisma from "@/lib/prisma";
import { DEFAULT_HOTEL_MENU } from "@/lib/hotel/default-menu";
import { HOTEL_CHECKOUT_HOUR } from "@/lib/hotel/constants";

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
  const checkIn = new Date(input.checkInDate);
  const checkOut = new Date(input.checkOutDate);
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
  const paid = stay.folio?.payments.reduce((s, p) => s + p.amountCdf, 0) ?? 0;
  const balance = charges - paid;
  if (balance > 0.01) {
    await prisma.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: "Check-out — solde à encaisser",
        body: `${stay.guestName} · solde ${balance.toFixed(2)}`,
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
            body: `${stay.guestName} · ch. ${stay.room.number} · +1 nuit (${unit})`,
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
    where: { branchId, active: true },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
}

export async function ensureHotelMenuSeedAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  const existing = await prisma.hotelMenuItem.findMany({
    where: { branchId },
    select: { name: true },
  });
  const known = new Set(existing.map((e) => e.name));
  const missing = DEFAULT_HOTEL_MENU.filter((item) => !known.has(item.name));
  if (missing.length > 0) {
    await prisma.hotelMenuItem.createMany({
      data: missing.map((item) => ({ branchId, ...item })),
    });
  }
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
    where: { branchId: input.branchId, id: { in: menuIds }, active: true },
  });
  if (menu.length !== menuIds.length) throw new Error("Article invalide.");

  const byId = new Map(menu.map((m) => [m.id, m]));
  const needsKitchen = menu.some((m) => m.needsKitchen);

  const order = await prisma.$transaction(async (tx) => {
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
          ? `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/cuisine`
          : `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse`,
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
}) {
  await ctx(input.organizationId, input.branchId);
  const order = await prisma.hotelOrder.findFirst({
    where: { id: input.orderId, branchId: input.branchId },
  });
  if (!order) throw new Error("Commande introuvable.");

  const data: {
    status: typeof input.to;
    readyAt?: Date;
    deliveredAt?: Date;
  } = { status: input.to };
  if (input.to === "PRETE") data.readyAt = new Date();
  if (input.to === "LIVREE") data.deliveredAt = new Date();

  await prisma.$transaction([
    prisma.hotelOrder.update({ where: { id: order.id }, data }),
    prisma.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: `Commande ${input.to}`,
        body: `Commande ${order.id.slice(0, 8)}… → ${input.to}`,
        kind: `order_${input.to.toLowerCase()}`,
        href:
          input.to === "PRETE" || input.to === "EN_CAISSE"
            ? `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse`
            : `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/restauration?view=suivi`,
      },
    }),
  ]);

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
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);

  const [notifications, unreadCount, kitchenOrders, readyOrders, toDeliver, arrivals, departures] =
    await Promise.all([
      prisma.branchNotification.findMany({
        where: { branchId },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.branchNotification.count({
        where: { branchId, readAt: null },
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
      prisma.hotelStay.count({
        where: {
          branchId,
          status: "RESERVED",
          checkInDate: { gte: start, lt: end },
        },
      }),
      prisma.hotelStay.count({
        where: {
          branchId,
          status: "CHECKED_IN",
          checkOutDate: { gte: start, lt: end },
        },
      }),
    ]);

  const attention =
    kitchenOrders + readyOrders + toDeliver + arrivals + departures + unreadCount;

  return {
    notifications,
    unreadCount,
    attention,
    ops: {
      kitchenOrders,
      readyOrders,
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
  const payments = await prisma.payment.aggregate({
    where: { branchId, paidAt: { gte: start } },
    _sum: { amountCdf: true },
    _count: true,
  });
  const fnbTickets = await prisma.hotelOrder.count({
    where: { branchId, paidAt: { gte: start }, status: { in: ["PAYEE", "LIVREE"] } },
  });
  return {
    rooms,
    occupied,
    occupancyPct: rooms ? Math.round((occupied / rooms) * 100) : 0,
    caJour: payments._sum.amountCdf ?? 0,
    paiementsJour: payments._count,
    ticketsFnbJour: fnbTickets,
  };
}

export async function createQuickSaleAction(input: {
  organizationId: string;
  branchId: string;
  items: { menuItemId: string; quantity: number }[];
  method: "CASH" | "MOBILE_MONEY" | "CARTE";
}) {
  const { createPaymentAction, getActiveExchangeRate } = await import(
    "@/lib/cash/actions"
  );
  const { user } = await ctx(input.organizationId, input.branchId);
  if (!input.items.length) throw new Error("Panier vide.");

  const menu = await prisma.hotelMenuItem.findMany({
    where: {
      branchId: input.branchId,
      id: { in: input.items.map((i) => i.menuItemId) },
      active: true,
    },
  });
  const byId = new Map(menu.map((m) => [m.id, m]));
  let totalUsd = 0;
  const lines = input.items.map((i) => {
    const m = byId.get(i.menuItemId);
    if (!m) throw new Error("Article invalide.");
    const qty = Math.max(1, i.quantity);
    const amount = m.price * qty;
    totalUsd += amount;
    return { m, qty, amount };
  });

  const rate = await getActiveExchangeRate(input.branchId);
  const amountCdf = rate ? totalUsd * rate.rate : totalUsd;

  const folio = await prisma.folio.create({
    data: {
      branchId: input.branchId,
      label: `Vente rapide`,
      lines: {
        create: lines.map(({ m, qty, amount }) => ({
          kind: m.needsKitchen ? "FNB" : "PRODUCT",
          description: m.name,
          quantity: qty,
          unitPrice: m.price,
          amount,
        })),
      },
    },
  });

  const payment = await createPaymentAction({
    organizationId: input.organizationId,
    branchId: input.branchId,
    amountCdf,
    amountForeign: totalUsd,
    method: input.method,
    folioId: folio.id,
    note: `Vente rapide par ${user.name ?? user.email}`,
  });

  await prisma.folio.update({
    where: { id: folio.id },
    data: { closed: true },
  });

  revalidateHotel(input.organizationId, input.branchId);
  return payment;
}
