"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import {
  assertHospitalityModule,
  type HospitalityModule,
} from "@/lib/branch/hospitality";
import { branchBasePath } from "@/lib/branch/paths";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/prisma/client";
import { FolioLineKind } from "@/prisma/generated/prisma/enums";
import { DEFAULT_HOTEL_MENU } from "@/lib/hotel/default-menu";
import { HOTEL_CHECKOUT_HOUR } from "@/lib/hotel/constants";
import {
  defaultNeedsKitchen,
  isConsumableCategory,
  isHotelMenuCategory,
} from "@/lib/hotel/menu-categories";
import {
  ORDER_SETTLEMENT,
  buildStayFolioStatement,
  isNoteChambreMode,
  postOrderToFolio,
  type OrderSettlementMode,
} from "@/lib/hotel/folio-note";
import {
  computeStayNightBilling,
  nightChargeDescription,
  nightsBetween,
} from "@/lib/hotel/stay-nights";
import {
  STAY_BILLING,
  assertStayRateInput,
  computeFlatOvertimeBilling,
  flatOvertimeDescription,
  flatStayDescription,
  isNegotiatedNightRate,
  nightlyStayDescription,
  resolveStayUnitPrice,
  type StayBillingMode,
} from "@/lib/hotel/stay-rate";

async function ctx(
  organizationId: string,
  branchId: string,
  module?: HospitalityModule,
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
  if (module) assertHospitalityModule(branch, module);
  return { user: session.user, branch };
}

function revalidateHotel(organizationId: string, branchId: string) {
  const base = branchBasePath(organizationId, branchId);
  revalidatePath(`${base}/hotel/sejours`);
  revalidatePath(`${base}/hotel/chambres`);
  revalidatePath(`${base}/hotel/salles-reunion`);
  revalidatePath(`${base}/hotel/produits`);
  revalidatePath(`${base}/hotel/livraison`);
  revalidatePath(`${base}/hotel/restauration`);
  revalidatePath(`${base}/hotel/cuisine`);
  revalidatePath(`${base}/caisse`);
  revalidatePath(`${base}/rapports/tableau-bord`);
  revalidatePath(base);
}

function startOfUtcDay(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function parseDateOnly(value: string | Date) {
  if (value instanceof Date) return startOfUtcDay(value);
  const [y, m, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, day ?? 1));
}

/**
 * Recalcule les lignes NIGHT du folio selon les jours réellement consommés
 * (règle sortie avant/après 10h). Idempotent.
 * Ignoré pour les séjours en mode forfait (FLAT).
 */
async function reconcileStayNightCharges(stayId: string, branchId: string) {
  const stay = await prisma.hotelStay.findFirst({
    where: { id: stayId, branchId, status: "CHECKED_IN" },
    include: {
      room: { include: { roomType: true } },
      folio: { include: { lines: true } },
    },
  });
  if (!stay?.folio) return null;
  if (stay.billingMode === STAY_BILLING.FLAT) {
    return { billing: null, amount: stay.flatAmount ?? 0, unit: 0, unchanged: true as const, flat: true as const };
  }

  const billing = computeStayNightBilling({
    checkInDate: stay.checkInDate,
    plannedCheckOutDate: stay.checkOutDate,
  });
  const catalog =
    stay.catalogUnitPrice > 0
      ? stay.catalogUnitPrice
      : stay.room.roomType.priceNight;
  const unit = resolveStayUnitPrice({
    catalogUnitPrice: catalog,
    unitPriceApplied: stay.unitPriceApplied,
  });
  const negotiated = isNegotiatedNightRate({
    catalogUnitPrice: catalog,
    unitPriceApplied: stay.unitPriceApplied,
  });
  const amount = billing.nights * unit;
  const description = nightChargeDescription({
    nights: billing.nights,
    roomNumber: stay.room.number,
    roomTypeName: stay.room.roomType.name,
    billing,
  });
  const fullDescription = negotiated
    ? nightlyStayDescription({
        nights: billing.nights,
        roomNumber: stay.room.number,
        roomTypeName: stay.room.roomType.name,
        negotiated: true,
        catalogUnitPrice: catalog,
        unitPriceApplied: unit,
        rateNote: stay.rateNote,
        suffix: description.includes(" · ")
          ? description.split(" · ").slice(2).join(" · ")
          : undefined,
      })
    : description;

  const nightLines = stay.folio.lines.filter((l) => l.kind === "NIGHT");
  const currentNightAmount = nightLines.reduce((s, l) => s + l.amount, 0);
  const currentNightQty = nightLines.reduce((s, l) => s + l.quantity, 0);
  const sameCharges =
    Math.abs(currentNightAmount - amount) < 0.01 &&
    Math.abs(currentNightQty - billing.nights) < 0.01 &&
    stay.checkOutDate.getTime() === billing.effectiveCheckOutDate.getTime();

  if (sameCharges && nightLines.length === 1) {
    return { billing, amount, unit, unchanged: true as const, flat: false as const };
  }

  await prisma.$transaction(async (tx) => {
    if (nightLines.length) {
      await tx.folioLine.deleteMany({
        where: {
          folioId: stay.folio!.id,
          kind: "NIGHT",
        },
      });
    }
    await tx.folioLine.create({
      data: {
        folioId: stay.folio!.id,
        kind: "NIGHT",
        description: fullDescription,
        quantity: billing.nights,
        unitPrice: unit,
        amount,
      },
    });
    await tx.hotelStay.update({
      where: { id: stay.id },
      data: { checkOutDate: billing.effectiveCheckOutDate },
    });
    await tx.folio.update({
      where: { id: stay.folio!.id },
      data: { updatedAt: new Date() },
    });
  });

  return { billing, amount, unit, unchanged: false as const, flat: false as const };
}

/**
 * Ajoute / met à jour les heures supplémentaires si le forfait est dépassé.
 * Tarif = flatAmount / plannedHours ; chaque heure entamée après le forfait est facturée.
 */
async function reconcileFlatOvertimeCharges(stayId: string, branchId: string) {
  const stay = await prisma.hotelStay.findFirst({
    where: { id: stayId, branchId, status: "CHECKED_IN" },
    include: {
      room: { include: { roomType: true } },
      folio: { include: { lines: true } },
    },
  });
  if (!stay?.folio) return null;
  if (stay.folio.closed) {
    return { overtime: null, unchanged: true as const };
  }
  if (stay.billingMode !== STAY_BILLING.FLAT) {
    return { overtime: null, unchanged: true as const };
  }

  const packageSlots = Math.max(
    1,
    stay.folio.lines.filter((l) => l.kind === "STAY_FLAT").length,
  );
  const overtime = computeFlatOvertimeBilling({
    plannedHours: stay.plannedHours,
    flatAmount: stay.flatAmount,
    checkedInAt: stay.checkedInAt,
    slots: packageSlots,
    // Figé dès la mise en file caisse — plus d’heures qui s’ajoutent après
    endedAt: stay.folio.checkoutQueuedAt ?? stay.checkedOutAt ?? undefined,
  });
  if (!overtime) {
    return { overtime: null, unchanged: true as const };
  }

  const existing = stay.folio.lines.filter((l) => l.kind === "STAY_OVERTIME");
  const targetAmount = overtime.amount;
  const targetQty = overtime.extraHours;

  if (targetQty <= 0 || targetAmount <= 0) {
    if (!existing.length) {
      return { overtime, unchanged: true as const };
    }
    await prisma.folioLine.deleteMany({
      where: { folioId: stay.folio.id, kind: FolioLineKind.STAY_OVERTIME },
    });
    await prisma.folio.update({
      where: { id: stay.folio.id },
      data: { updatedAt: new Date() },
    });
    return { overtime, unchanged: false as const };
  }

  const description = flatOvertimeDescription({
    roomNumber: stay.room.number,
    roomTypeName: stay.room.roomType.name,
    extraHours: overtime.extraHours,
    hourlyRate: overtime.hourlyRate,
    overdueMinutes: overtime.overdueMinutes,
  });

  const same =
    existing.length === 1 &&
    Math.abs(existing[0]!.amount - targetAmount) < 0.01 &&
    Math.abs(existing[0]!.quantity - targetQty) < 0.01;

  if (same) {
    return { overtime, unchanged: true as const };
  }

  await prisma.$transaction(async (tx) => {
    if (existing.length) {
      await tx.folioLine.deleteMany({
        where: { folioId: stay.folio!.id, kind: FolioLineKind.STAY_OVERTIME },
      });
    }
    await tx.folioLine.create({
      data: {
        folioId: stay.folio!.id,
        kind: FolioLineKind.STAY_OVERTIME,
        description,
        quantity: targetQty,
        unitPrice: overtime.hourlyRate,
        amount: targetAmount,
      },
    });
    await tx.folio.update({
      where: { id: stay.folio!.id },
      data: { updatedAt: new Date() },
    });
  });

  return { overtime, unchanged: false as const };
}

/** Recalcule nuitées (NIGHTLY) ou heures supp. (FLAT) avant check-out / caisse. */
async function reconcileStayCheckoutCharges(stayId: string, branchId: string) {
  const night = await reconcileStayNightCharges(stayId, branchId);
  const overtime = await reconcileFlatOvertimeCharges(stayId, branchId);
  return { night, overtime };
}

export async function listRoomsWithTypesAction(
  organizationId: string,
  branchId: string,
  opts?: { kind?: "ROOM" | "MEETING" },
) {
  await ctx(organizationId, branchId, "stays");
  return prisma.hotelRoom.findMany({
    where: {
      roomType: {
        branchId,
        ...(opts?.kind ? { kind: opts.kind } : {}),
      },
    },
    include: { roomType: true },
    orderBy: [{ roomType: { name: "asc" } }, { number: "asc" }],
  });
}

export async function listRoomTypesAction(
  organizationId: string,
  branchId: string,
  opts?: { kind?: "ROOM" | "MEETING" },
) {
  await ctx(organizationId, branchId, "stays");
  return prisma.hotelRoomType.findMany({
    where: {
      branchId,
      ...(opts?.kind ? { kind: opts.kind } : {}),
    },
    orderBy: { name: "asc" },
  });
}

export async function createHotelRoomAction(input: {
  organizationId: string;
  branchId: string;
  number: string;
  floor?: string | null;
  roomTypeId?: string | null;
  /** ROOM (défaut) | MEETING — pour nouveau type */
  spaceKind?: "ROOM" | "MEETING";
  /** Créer un type en même temps si aucun roomTypeId */
  newType?: {
    name: string;
    capacity?: number;
    seatsStandard?: number | null;
    seatsVip?: number | null;
    priceNight: number;
    description?: string | null;
  } | null;
}) {
  await ctx(input.organizationId, input.branchId, "stays");
  const number = input.number.trim();
  if (!number) throw new Error("Numéro requis.");
  const spaceKind = input.spaceKind === "MEETING" ? "MEETING" : "ROOM";

  const existingNumber = await prisma.hotelRoom.findFirst({
    where: {
      number,
      roomType: { branchId: input.branchId },
    },
  });
  if (existingNumber) {
    throw new Error(
      spaceKind === "MEETING"
        ? `La salle ${number} existe déjà sur cette branche.`
        : `La chambre ${number} existe déjà sur cette branche.`,
    );
  }

  let roomTypeId = input.roomTypeId?.trim() || "";
  if (!roomTypeId) {
    const name = input.newType?.name?.trim() || "";
    const priceNight = Number(input.newType?.priceNight);
    const seatsStandard =
      spaceKind === "MEETING" &&
      input.newType?.seatsStandard != null &&
      Number.isFinite(Number(input.newType.seatsStandard))
        ? Math.max(0, Math.round(Number(input.newType.seatsStandard)))
        : null;
    const seatsVip =
      spaceKind === "MEETING" &&
      input.newType?.seatsVip != null &&
      Number.isFinite(Number(input.newType.seatsVip))
        ? Math.max(0, Math.round(Number(input.newType.seatsVip)))
        : null;
    const capacityFromSeats =
      seatsStandard != null || seatsVip != null
        ? (seatsStandard ?? 0) + (seatsVip ?? 0)
        : null;
    const capacity = Math.round(
      Number(
        capacityFromSeats != null && capacityFromSeats > 0
          ? capacityFromSeats
          : (input.newType?.capacity ?? 2),
      ),
    );
    if (!name) {
      throw new Error(
        spaceKind === "MEETING"
          ? "Type de salle requis."
          : "Type de chambre requis.",
      );
    }
    if (!Number.isFinite(priceNight) || priceNight < 0) {
      throw new Error("Tarif invalide.");
    }
    if (!Number.isFinite(capacity) || capacity < 1) {
      throw new Error("Capacité invalide.");
    }
    const createdType = await prisma.hotelRoomType.create({
      data: {
        branchId: input.branchId,
        name,
        capacity,
        seatsStandard: spaceKind === "MEETING" ? seatsStandard : null,
        seatsVip: spaceKind === "MEETING" ? seatsVip : null,
        priceNight,
        kind: spaceKind,
        description: input.newType?.description?.trim() || null,
      },
    });
    roomTypeId = createdType.id;
  } else {
    const type = await prisma.hotelRoomType.findFirst({
      where: {
        id: roomTypeId,
        branchId: input.branchId,
        kind: spaceKind,
      },
    });
    if (!type) {
      throw new Error(
        spaceKind === "MEETING"
          ? "Type de salle introuvable."
          : "Type de chambre introuvable.",
      );
    }
  }

  const room = await prisma.hotelRoom.create({
    data: {
      roomTypeId,
      number,
      floor: input.floor?.trim() || null,
      status: "AVAILABLE",
    },
    include: { roomType: true },
  });
  revalidateHotel(input.organizationId, input.branchId);
  return room;
}

export async function updateHotelRoomAction(input: {
  organizationId: string;
  branchId: string;
  roomId: string;
  number: string;
  floor?: string | null;
  roomTypeId: string;
  spaceKind?: "ROOM" | "MEETING";
  status?: "AVAILABLE" | "OCCUPIED" | "CLEANING" | "OUT_OF_ORDER";
}) {
  await ctx(input.organizationId, input.branchId, "stays");
  const spaceKind = input.spaceKind === "MEETING" ? "MEETING" : "ROOM";
  const room = await prisma.hotelRoom.findFirst({
    where: {
      id: input.roomId,
      roomType: { branchId: input.branchId, kind: spaceKind },
    },
  });
  if (!room) {
    throw new Error(
      spaceKind === "MEETING" ? "Salle introuvable." : "Chambre introuvable.",
    );
  }

  const number = input.number.trim();
  if (!number) throw new Error("Numéro requis.");

  const type = await prisma.hotelRoomType.findFirst({
    where: {
      id: input.roomTypeId,
      branchId: input.branchId,
      kind: spaceKind,
    },
  });
  if (!type) {
    throw new Error(
      spaceKind === "MEETING"
        ? "Type de salle introuvable."
        : "Type de chambre introuvable.",
    );
  }

  const clash = await prisma.hotelRoom.findFirst({
    where: {
      id: { not: room.id },
      number,
      roomType: { branchId: input.branchId },
    },
  });
  if (clash) {
    throw new Error(
      spaceKind === "MEETING"
        ? `La salle ${number} existe déjà sur cette branche.`
        : `La chambre ${number} existe déjà sur cette branche.`,
    );
  }

  const updated = await prisma.hotelRoom.update({
    where: { id: room.id },
    data: {
      number,
      floor: input.floor?.trim() || null,
      roomTypeId: type.id,
      ...(input.status ? { status: input.status } : {}),
    },
    include: { roomType: true },
  });
  revalidateHotel(input.organizationId, input.branchId);
  return updated;
}

export async function updateRoomStatusAction(input: {
  organizationId: string;
  branchId: string;
  roomId: string;
  status: "AVAILABLE" | "OCCUPIED" | "CLEANING" | "OUT_OF_ORDER";
}) {
  await ctx(input.organizationId, input.branchId, "stays");
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
  await ctx(organizationId, branchId, "stays");
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return prisma.hotelStay.findMany({
    where: {
      branchId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      OR: [
        {
          checkInDate: { lt: end },
          checkOutDate: { gt: start },
        },
        {
          checkedOutAt: { gte: start, lt: end },
        },
        // Forfait même jour (checkIn === checkOut) : gt start exclut le 1er du mois
        {
          checkInDate: { gte: start, lt: end },
          checkOutDate: { gte: start, lt: end },
        },
      ],
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
  await ctx(organizationId, branchId, "stays");
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
  /** NIGHTLY (défaut) | FLAT */
  billingMode?: StayBillingMode;
  /** Tarif / nuit appliqué (NIGHTLY) ; défaut = catalogue */
  unitPriceApplied?: number | null;
  /** Montant forfait (FLAT) */
  flatAmount?: number | null;
  plannedHours?: number | null;
  rateNote?: string | null;
}) {
  const { user } = await ctx(input.organizationId, input.branchId, "stays");
  const checkIn = parseDateOnly(input.checkInDate);
  const checkOut = parseDateOnly(input.checkOutDate);
  const room = await prisma.hotelRoom.findFirst({
    where: { id: input.roomId, roomType: { branchId: input.branchId } },
    include: { roomType: true },
  });
  if (!room) throw new Error("Espace introuvable.");

  const isMeeting = room.roomType.kind === "MEETING";
  const billingMode: StayBillingMode =
    input.billingMode === STAY_BILLING.FLAT || isMeeting
      ? STAY_BILLING.FLAT
      : STAY_BILLING.NIGHTLY;

  if (billingMode === STAY_BILLING.FLAT) {
    if (checkOut < checkIn) throw new Error("Dates invalides.");
  } else if (!(checkOut > checkIn)) {
    throw new Error("Dates invalides.");
  }

  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  if (checkIn.getTime() < todayUtc.getTime()) {
    throw new Error("Impossible de réserver à une date antérieure.");
  }

  const overlapStay = await prisma.hotelStay.findFirst({
    where: {
      roomId: room.id,
      status: { in: ["RESERVED", "CHECKED_IN"] },
      ...(checkOut.getTime() === checkIn.getTime()
        ? {
            OR: [
              {
                checkInDate: { lte: checkIn },
                checkOutDate: { gt: checkIn },
              },
              { checkInDate: checkIn, checkOutDate: checkIn },
            ],
          }
        : {
            checkInDate: { lt: checkOut },
            checkOutDate: { gt: checkIn },
          }),
    },
  });
  if (overlapStay) {
    throw new Error(
      isMeeting
        ? "Salle déjà réservée sur cette période."
        : "Chambre déjà réservée sur cette période.",
    );
  }

  const catalogUnitPrice = room.roomType.priceNight;
  const unitPriceApplied =
    billingMode === STAY_BILLING.NIGHTLY &&
    input.unitPriceApplied != null &&
    Number.isFinite(input.unitPriceApplied)
      ? Number(input.unitPriceApplied)
      : null;
  const flatAmount =
    billingMode === STAY_BILLING.FLAT &&
    input.flatAmount != null &&
    Number.isFinite(input.flatAmount)
      ? Number(input.flatAmount)
      : null;
  const rateNote = input.rateNote?.trim() || null;
  const plannedHours =
    billingMode === STAY_BILLING.FLAT &&
    input.plannedHours != null &&
    Number.isFinite(input.plannedHours)
      ? Math.max(0, Math.round(Number(input.plannedHours)))
      : null;

  assertStayRateInput({
    billingMode,
    catalogUnitPrice,
    unitPriceApplied,
    flatAmount,
    plannedHours,
    rateNote,
  });

  const negotiated =
    billingMode === STAY_BILLING.NIGHTLY &&
    isNegotiatedNightRate({ catalogUnitPrice, unitPriceApplied });
  const appliedUnit = resolveStayUnitPrice({
    catalogUnitPrice,
    unitPriceApplied,
  });
  const nights =
    billingMode === STAY_BILLING.NIGHTLY
      ? nightsBetween(checkIn, checkOut)
      : 1;
  const nightAmount =
    billingMode === STAY_BILLING.NIGHTLY
      ? nights * appliedUnit
      : (flatAmount ?? 0);

  const stay = await prisma.$transaction(async (tx) => {
    const today = new Date();
    const todayUtc = new Date(
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
    );
    const checkInIsToday = checkIn.getTime() === todayUtc.getTime();
    // Forfait / au temps : toujours check-in immédiat.
    // Nuitée avec entrée aujourd’hui : check-in direct (pas de réservation).
    const immediateCheckIn =
      billingMode === STAY_BILLING.FLAT || checkInIsToday;
    const now = new Date();
    const s = await tx.hotelStay.create({
      data: {
        branchId: input.branchId,
        roomId: room.id,
        guestName: input.guestName.trim(),
        guestPhone: input.guestPhone?.trim() || null,
        checkInDate: checkIn,
        checkOutDate:
          billingMode === STAY_BILLING.FLAT &&
          checkOut.getTime() === checkIn.getTime()
            ? checkIn
            : checkOut,
        adults: input.adults ?? 1,
        notes: input.notes ?? null,
        status: immediateCheckIn ? "CHECKED_IN" : "RESERVED",
        checkedInAt: immediateCheckIn ? now : null,
        billingMode,
        catalogUnitPrice,
        unitPriceApplied:
          billingMode === STAY_BILLING.NIGHTLY ? unitPriceApplied : null,
        flatAmount: billingMode === STAY_BILLING.FLAT ? flatAmount : null,
        plannedHours,
        rateNote,
        negotiatedByUserId:
          negotiated || billingMode === STAY_BILLING.FLAT ? user.id : null,
      },
    });
    if (immediateCheckIn) {
      await tx.hotelRoom.update({
        where: { id: room.id },
        data: { status: "OCCUPIED" },
      });
    }
    await tx.folio.create({
      data: {
        branchId: input.branchId,
        stayId: s.id,
        label: `Séjour ${input.guestName.trim()}`,
        lines: {
          create:
            billingMode === STAY_BILLING.FLAT
              ? {
                  kind: "STAY_FLAT",
                  description: flatStayDescription({
                    roomNumber: room.number,
                    roomTypeName: room.roomType.name,
                    flatAmount: flatAmount ?? 0,
                    plannedHours,
                    rateNote,
                  }),
                  quantity: 1,
                  unitPrice: flatAmount ?? 0,
                  amount: flatAmount ?? 0,
                }
              : {
                  kind: "NIGHT",
                  description: nightlyStayDescription({
                    nights,
                    roomNumber: room.number,
                    roomTypeName: room.roomType.name,
                    negotiated,
                    catalogUnitPrice,
                    unitPriceApplied: appliedUnit,
                    rateNote,
                  }),
                  quantity: nights,
                  unitPrice: appliedUnit,
                  amount: nightAmount,
                },
        },
      },
    });
    await tx.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: immediateCheckIn
          ? billingMode === STAY_BILLING.FLAT
            ? "Passage démarré"
            : "Check-in effectué"
          : "Nouvelle réservation",
        body: immediateCheckIn
          ? `${input.guestName.trim()} · ${isMeeting ? "salle" : "ch."} ${room.number} · check-in`
          : `${input.guestName.trim()} · ch. ${room.number}`,
        kind: immediateCheckIn ? "stay_checkin" : "stay_reserved",
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
  await ctx(input.organizationId, input.branchId, "stays");
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
  await ctx(input.organizationId, input.branchId, "stays");
  // Facture = nuitées (règle 10h) ou forfait + heures supp. + conso déjà sur la note
  await reconcileStayCheckoutCharges(input.stayId, input.branchId);

  const stay = await prisma.hotelStay.findFirst({
    where: { id: input.stayId, branchId: input.branchId },
    include: {
      folio: { include: { lines: true, payments: true } },
      room: { include: { roomType: true } },
    },
  });
  if (!stay) throw new Error("Séjour introuvable.");
  if (stay.status !== "CHECKED_IN") throw new Error("Check-out impossible.");

  const charges = stay.folio?.lines.reduce((s, l) => s + l.amount, 0) ?? 0;
  const paid =
    stay.folio?.payments.reduce(
      (s, p) =>
        s +
        (p.amountForeign != null && p.amountForeign !== 0
          ? p.amountForeign
          : p.amountCdf),
      0,
    ) ?? 0;
  const balance = charges - paid;
  if (balance > 0.01) {
    if (stay.folio) {
      await prisma.$transaction([
        prisma.folio.update({
          where: { id: stay.folio.id },
          data: { checkoutQueuedAt: new Date() },
        }),
        prisma.branchNotification.create({
          data: {
            branchId: input.branchId,
            title: "File d’attente check-out",
            body: `${stay.guestName} · solde ${balance.toFixed(2)} $`,
            kind: "checkout_queue",
            href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse?tab=folios&queue=1`,
          },
        }),
      ]);
    }
    return {
      ok: false as const,
      needsPayment: true,
      needsRefund: false,
      balance,
      folioId: stay.folio?.id ?? null,
    };
  }

  if (balance < -0.01) {
    if (stay.folio) {
      await prisma.$transaction([
        prisma.folio.update({
          where: { id: stay.folio.id },
          data: { checkoutQueuedAt: new Date() },
        }),
        prisma.branchNotification.create({
          data: {
            branchId: input.branchId,
            title: "Remboursement check-out",
            body: `${stay.guestName} · à rembourser ${Math.abs(balance).toFixed(2)} $ (nuitées consommées, règle ${HOTEL_CHECKOUT_HOUR}h)`,
            kind: "checkout_refund",
            href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse?tab=folios&queue=1`,
          },
        }),
      ]);
    }
    return {
      ok: false as const,
      needsPayment: false,
      needsRefund: true,
      balance,
      folioId: stay.folio?.id ?? null,
    };
  }

  const freeStatus =
    stay.room.roomType.kind === "MEETING" ? "AVAILABLE" : "CLEANING";

  await prisma.$transaction([
    prisma.hotelStay.update({
      where: { id: stay.id },
      data: { status: "CHECKED_OUT", checkedOutAt: new Date() },
    }),
    prisma.hotelRoom.update({
      where: { id: stay.roomId },
      data: { status: freeStatus },
    }),
    ...(stay.folio
      ? [
          prisma.folio.update({
            where: { id: stay.folio.id },
            data: { closed: true, checkoutQueuedAt: null },
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
  return {
    ok: true as const,
    needsPayment: false,
    needsRefund: false,
    balance: 0,
    folioId: stay.folio?.id ?? null,
  };
}

/**
 * Prolongation de séjour :
 * - NIGHTLY : décale la sortie et facture les nuitées ajoutées
 * - FLAT : ajoute un créneau de même durée / même forfait (pas de règle 10h)
 */
export async function extendStayAction(input: {
  organizationId: string;
  branchId: string;
  stayId: string;
  /** Requis en mode NIGHTLY */
  newCheckOutDate?: string;
}) {
  await ctx(input.organizationId, input.branchId, "stays");
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

  if (stay.billingMode === STAY_BILLING.FLAT) {
    const hours = stay.plannedHours;
    const amount = stay.flatAmount;
    if (hours == null || !(hours > 0)) {
      throw new Error("Durée du passage introuvable — impossible de prolonger.");
    }
    if (amount == null || !(amount >= 0)) {
      throw new Error("Montant passage introuvable — impossible de prolonger.");
    }

    await prisma.$transaction(async (tx) => {
      if (stay.folio) {
        await tx.folioLine.create({
          data: {
            folioId: stay.folio.id,
            kind: "STAY_FLAT",
            description: flatStayDescription({
              roomNumber: stay.room.number,
              roomTypeName: stay.room.roomType.name,
              flatAmount: amount,
              plannedHours: hours,
              rateNote: stay.rateNote,
              prolongation: true,
            }),
            quantity: 1,
            unitPrice: amount,
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
          title: "Passage prolongé",
          body: `${stay.guestName} · +${hours} h · ch. ${stay.room.number}`,
          kind: "stay_extended",
          href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/sejours`,
        },
      });
    });

    revalidateHotel(input.organizationId, input.branchId);
    return {
      mode: "FLAT" as const,
      extraNights: 0,
      extraHours: hours,
      amount,
      newCheckOutDate: stay.checkOutDate.toISOString().slice(0, 10),
    };
  }

  if (!input.newCheckOutDate) {
    throw new Error("Nouvelle date de sortie requise.");
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
  const catalog =
    stay.catalogUnitPrice > 0
      ? stay.catalogUnitPrice
      : stay.room.roomType.priceNight;
  const unit = resolveStayUnitPrice({
    catalogUnitPrice: catalog,
    unitPriceApplied: stay.unitPriceApplied,
  });
  const amount = extraNights * unit;
  const negotiated = isNegotiatedNightRate({
    catalogUnitPrice: catalog,
    unitPriceApplied: stay.unitPriceApplied,
  });

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
          description: nightlyStayDescription({
            nights: extraNights,
            roomNumber: stay.room.number,
            roomTypeName: stay.room.roomType.name,
            negotiated,
            catalogUnitPrice: catalog,
            unitPriceApplied: unit,
            rateNote: stay.rateNote,
            suffix: "prolongation",
          }),
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
  return {
    mode: "NIGHTLY" as const,
    extraNights,
    extraHours: 0,
    amount,
    newCheckOutDate: newOut.toISOString().slice(0, 10),
  };
}

/**
 * Séjours encore présents le jour de sortie (ou après) passé 10h :
 * recalcule les nuitées consommées (règle 10h).
 */
export async function applyLateCheckoutFeesAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, "stays");
  const now = new Date();
  if (now.getHours() < HOTEL_CHECKOUT_HOUR) {
    return { charged: 0 };
  }

  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );

  const stays = await prisma.hotelStay.findMany({
    where: {
      branchId,
      status: "CHECKED_IN",
      billingMode: "NIGHTLY",
      checkOutDate: { lte: today },
    },
    select: { id: true, guestName: true, room: { select: { number: true } } },
  });

  let charged = 0;
  for (const stay of stays) {
    const res = await reconcileStayNightCharges(stay.id, branchId);
    if (res && !res.unchanged && res.billing?.lateDeparture) {
      charged += 1;
      await prisma.branchNotification.create({
        data: {
          branchId,
          title: "Nuitées recalculées (retard 10h)",
          body: `${stay.guestName} · ch. ${stay.room.number} · ${res.billing.nights} nuit(s)`,
          kind: "stay_late_checkout",
          href: `/admin/organizations/${organizationId}/branches/${branchId}/caisse?tab=folios`,
        },
      });
    }
  }

  if (charged > 0) revalidateHotel(organizationId, branchId);
  return { charged };
}

export async function listMenuItemsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, "restaurant");
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
  await ctx(organizationId, branchId, "restaurant");
  const items = await prisma.hotelMenuItem.findMany({
    where: { branchId },
    orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
  });
  const names = await resolveUserNames(
    items
      .map((i) => i.createdByUserId)
      .filter((id): id is string => Boolean(id)),
  );
  return items.map((item) => ({
    ...item,
    createdByName: item.createdByUserId
      ? (names.get(item.createdByUserId) ?? "Membre")
      : null,
  }));
}

/** Consommables actifs pour la page Livraison. */
export async function listConsumableItemsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, "livraison");
  const items = await prisma.hotelMenuItem.findMany({
    where: { branchId, isConsumable: true, active: true },
    orderBy: [{ name: "asc" }],
  });
  const names = await resolveUserNames(
    items
      .map((i) => i.createdByUserId)
      .filter((id): id is string => Boolean(id)),
  );
  return items.map((item) => ({
    ...item,
    createdByName: item.createdByUserId
      ? (names.get(item.createdByUserId) ?? "Membre")
      : null,
  }));
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
  await ctx(organizationId, branchId, "livraison");
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

  const enriched = await enrichMovementStocks(branchId, rows);
  const names = await resolveUserNames(enriched.map((r) => r.createdByUserId));
  return enriched.map((row) => ({
    ...row,
    createdByName: names.get(row.createdByUserId) ?? "Membre",
  }));
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

async function resolveUserNames(userIds: string[]) {
  const ids = [...new Set(userIds.filter(Boolean))];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  for (const u of users) {
    map.set(u.id, (u.name?.trim() || u.email || "Membre").trim());
  }
  return map;
}

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
  const { user } = await ctx(input.organizationId, input.branchId, "restaurant");
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
      createdByUserId: user.id,
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
  await ctx(input.organizationId, input.branchId, "restaurant");
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
  await ctx(input.organizationId, input.branchId, "restaurant");
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
  const { user } = await ctx(input.organizationId, input.branchId, "livraison");
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
  await ctx(organizationId, branchId, "restaurant");
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

export async function listActiveStaysForChargeAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId, "restaurant");
  return prisma.hotelStay.findMany({
    where: {
      branchId,
      status: "CHECKED_IN",
      folio: { is: { closed: false } },
    },
    include: {
      room: true,
      folio: { select: { id: true, closed: true } },
    },
    orderBy: [{ room: { number: "asc" } }, { guestName: "asc" }],
  });
}

export async function getStayFolioStatementAction(
  organizationId: string,
  branchId: string,
  stayId: string,
  opts?: { forCheckout?: boolean },
) {
  await ctx(organizationId, branchId, "stays");

  const stay = await prisma.hotelStay.findFirst({
    where: { id: stayId, branchId },
    include: {
      room: { include: { roomType: true } },
      folio: {
        include: {
          lines: { orderBy: { createdAt: "asc" } },
          payments: { orderBy: { paidAt: "asc" } },
        },
      },
    },
  });
  if (!stay?.folio) throw new Error("Note de chambre introuvable.");

  let nightBilling: ReturnType<typeof computeStayNightBilling> | null = null;
  let folioForStatement = stay.folio;
  const catalog =
    stay.catalogUnitPrice > 0
      ? stay.catalogUnitPrice
      : stay.room.roomType.priceNight;
  const appliedUnit = resolveStayUnitPrice({
    catalogUnitPrice: catalog,
    unitPriceApplied: stay.unitPriceApplied,
  });
  const negotiated = isNegotiatedNightRate({
    catalogUnitPrice: catalog,
    unitPriceApplied: stay.unitPriceApplied,
  });

  if (
    opts?.forCheckout &&
    stay.status === "CHECKED_IN" &&
    stay.billingMode !== STAY_BILLING.FLAT
  ) {
    const existingNightQty = stay.folio.lines
      .filter((l) => l.kind === "NIGHT")
      .reduce((s, l) => s + l.quantity, 0);
    nightBilling = computeStayNightBilling({
      checkInDate: stay.checkInDate,
      plannedCheckOutDate: stay.checkOutDate,
    });
    // Si la note a déjà été réduite, conserver le volume initial pour le libellé « prévu »
    if (existingNightQty > nightBilling.plannedNights) {
      nightBilling = {
        ...nightBilling,
        plannedNights: existingNightQty,
        earlyDeparture: nightBilling.nights < existingNightQty,
      };
    } else if (existingNightQty > nightBilling.nights) {
      nightBilling = {
        ...nightBilling,
        plannedNights: Math.max(nightBilling.plannedNights, existingNightQty),
        earlyDeparture: true,
      };
    }
    const amount = nightBilling.nights * appliedUnit;
    const description = nightChargeDescription({
      nights: nightBilling.nights,
      roomNumber: stay.room.number,
      roomTypeName: stay.room.roomType.name,
      billing: nightBilling,
    });
    const fullDescription = negotiated
      ? nightlyStayDescription({
          nights: nightBilling.nights,
          roomNumber: stay.room.number,
          roomTypeName: stay.room.roomType.name,
          negotiated: true,
          catalogUnitPrice: catalog,
          unitPriceApplied: appliedUnit,
          rateNote: stay.rateNote,
        })
      : description;
    const nonNight = stay.folio.lines.filter((l) => l.kind !== "NIGHT");
    folioForStatement = {
      ...stay.folio,
      lines: [
        {
          id: "preview-night",
          folioId: stay.folio.id,
          kind: "NIGHT" as const,
          description: fullDescription,
          quantity: nightBilling.nights,
          unitPrice: appliedUnit,
          amount,
          createdAt: new Date(),
        },
        ...nonNight,
      ],
    };
  }

  let flatOvertimePreview: ReturnType<typeof computeFlatOvertimeBilling> = null;
  if (
    opts?.forCheckout &&
    stay.status === "CHECKED_IN" &&
    stay.billingMode === STAY_BILLING.FLAT
  ) {
    const packageSlots = Math.max(
      1,
      stay.folio.lines.filter((l) => l.kind === "STAY_FLAT").length,
    );
    flatOvertimePreview = computeFlatOvertimeBilling({
      plannedHours: stay.plannedHours,
      flatAmount: stay.flatAmount,
      checkedInAt: stay.checkedInAt,
      slots: packageSlots,
      endedAt: stay.folio.checkoutQueuedAt ?? undefined,
    });
    const withoutOvertime = stay.folio.lines.filter(
      (l) => l.kind !== "STAY_OVERTIME",
    );
    if (
      flatOvertimePreview &&
      flatOvertimePreview.extraHours > 0 &&
      flatOvertimePreview.amount > 0
    ) {
      folioForStatement = {
        ...stay.folio,
        lines: [
          ...withoutOvertime,
          {
            id: "preview-overtime",
            folioId: stay.folio.id,
            kind: "STAY_OVERTIME" as const,
            description: flatOvertimeDescription({
              roomNumber: stay.room.number,
              roomTypeName: stay.room.roomType.name,
              extraHours: flatOvertimePreview.extraHours,
              hourlyRate: flatOvertimePreview.hourlyRate,
              overdueMinutes: flatOvertimePreview.overdueMinutes,
            }),
            quantity: flatOvertimePreview.extraHours,
            unitPrice: flatOvertimePreview.hourlyRate,
            amount: flatOvertimePreview.amount,
            createdAt: new Date(),
          },
        ],
      };
    } else {
      folioForStatement = { ...stay.folio, lines: withoutOvertime };
    }
  }

  const statement = buildStayFolioStatement({
    stay,
    folio: folioForStatement,
  });
  return {
    ...statement,
    rateInfo: {
      billingMode: stay.billingMode,
      catalogUnitPrice: catalog,
      unitPriceApplied: stay.unitPriceApplied,
      appliedUnit:
        stay.billingMode === STAY_BILLING.FLAT
          ? (stay.flatAmount ?? 0)
          : appliedUnit,
      flatAmount: stay.flatAmount,
      plannedHours: stay.plannedHours,
      rateNote: stay.rateNote,
      negotiated:
        stay.billingMode === STAY_BILLING.FLAT || negotiated,
    },
    nightBilling: nightBilling
      ? {
          nights: nightBilling.nights,
          plannedNights: nightBilling.plannedNights,
          pastCheckoutHour: nightBilling.pastCheckoutHour,
          earlyDeparture: nightBilling.earlyDeparture,
          lateDeparture: nightBilling.lateDeparture,
          checkoutHour: nightBilling.checkoutHour,
        }
      : null,
    flatOvertime: flatOvertimePreview
      ? {
          extraHours: flatOvertimePreview.extraHours,
          hourlyRate: flatOvertimePreview.hourlyRate,
          amount: flatOvertimePreview.amount,
          overdueMinutes: flatOvertimePreview.overdueMinutes,
        }
      : null,
  };
}

/** Persiste le recalcul des nuitées (jours consommés + règle 10h) avant encaissement. */
export async function prepareStayCheckoutBillingAction(input: {
  organizationId: string;
  branchId: string;
  stayId: string;
}) {
  await ctx(input.organizationId, input.branchId, "stays");
  const res = await reconcileStayCheckoutCharges(input.stayId, input.branchId);

  const stay = await prisma.hotelStay.findFirst({
    where: { id: input.stayId, branchId: input.branchId },
    include: {
      room: true,
      folio: { include: { lines: true, payments: true } },
    },
  });
  if (!stay?.folio) throw new Error("Note de chambre introuvable.");

  const charges = stay.folio.lines.reduce((s, l) => s + l.amount, 0);
  const paid = stay.folio.payments.reduce(
    (s, p) =>
      s +
      (p.amountForeign != null && p.amountForeign !== 0
        ? p.amountForeign
        : p.amountCdf),
    0,
  );
  const balance = charges - paid;
  const needsPayment = balance > 0.01;
  const needsRefund = balance < -0.01;

  if (needsPayment || needsRefund) {
    await prisma.$transaction([
      prisma.folio.update({
        where: { id: stay.folio.id },
        data: { checkoutQueuedAt: new Date() },
      }),
      prisma.branchNotification.create({
        data: {
          branchId: input.branchId,
          title: needsRefund
            ? "Remboursement check-out"
            : "File d’attente check-out",
          body: needsRefund
            ? `${stay.guestName} · ch. ${stay.room.number} · à rembourser ${Math.abs(balance).toFixed(2)} $ (nuitées consommées, règle ${HOTEL_CHECKOUT_HOUR}h)`
            : `${stay.guestName} · ch. ${stay.room.number} · solde ${balance.toFixed(2)} $`,
          kind: needsRefund ? "checkout_refund" : "checkout_queue",
          href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse?tab=folios&queue=1`,
        },
      }),
    ]);
  }

  revalidateHotel(input.organizationId, input.branchId);
  return {
    ...res,
    folioId: stay.folio.id,
    guestName: stay.guestName,
    roomNumber: stay.room.number,
    balance,
    needsPayment,
    needsRefund,
  };
}

export async function createHotelOrderAction(input: {
  organizationId: string;
  branchId: string;
  tableLabel?: string;
  stayId?: string;
  /** COMPTANT (défaut) | NOTE_CHAMBRE */
  settlementMode?: OrderSettlementMode;
  items: { menuItemId: string; quantity: number }[];
}) {
  const { user } = await ctx(input.organizationId, input.branchId, "restaurant");
  if (!input.items.length) throw new Error("Ajoutez au moins un article.");

  const settlementMode: OrderSettlementMode =
    input.settlementMode === ORDER_SETTLEMENT.NOTE_CHAMBRE
      ? ORDER_SETTLEMENT.NOTE_CHAMBRE
      : ORDER_SETTLEMENT.COMPTANT;

  let folioId: string | null = null;
  let stayId: string | null = input.stayId?.trim() || null;
  let tableLabel = input.tableLabel?.trim() || null;

  if (settlementMode === ORDER_SETTLEMENT.NOTE_CHAMBRE) {
    if (!stayId) {
      throw new Error("Sélectionnez un séjour pour reporter sur la note.");
    }
    const stay = await prisma.hotelStay.findFirst({
      where: {
        id: stayId,
        branchId: input.branchId,
        status: "CHECKED_IN",
      },
      include: {
        room: true,
        folio: true,
      },
    });
    if (!stay?.folio || stay.folio.closed) {
      throw new Error("Note de chambre indisponible pour ce séjour.");
    }
    folioId = stay.folio.id;
    if (!tableLabel) {
      tableLabel = `Ch. ${stay.room.number} · ${stay.guestName}`;
    }
  } else if (stayId) {
    const stay = await prisma.hotelStay.findFirst({
      where: {
        id: stayId,
        branchId: input.branchId,
        status: "CHECKED_IN",
      },
      include: { room: true },
    });
    if (!stay) throw new Error("Séjour introuvable.");
    if (!tableLabel) {
      tableLabel = `Ch. ${stay.room.number} · ${stay.guestName}`;
    }
  }

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
  const onNote = settlementMode === ORDER_SETTLEMENT.NOTE_CHAMBRE;

  const order = await prisma.$transaction(async (tx) => {
    await consumeMenuStock(tx, input.branchId, input.items);

    const o = await tx.hotelOrder.create({
      data: {
        branchId: input.branchId,
        stayId,
        folioId,
        tableLabel,
        settlementMode,
        status: needsKitchen ? "ENVOYEE" : onNote ? "LIVREE" : "PRETE",
        createdByUserId: user.id,
        sentAt: new Date(),
        readyAt: needsKitchen ? null : new Date(),
        deliveredAt: !needsKitchen && onNote ? new Date() : null,
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

    if (!needsKitchen && onNote) {
      await postOrderToFolio(tx, o.id);
    }

    const noteHref = `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/restauration?view=suivi&orderId=${o.id}`;
    await tx.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: needsKitchen
          ? onNote
            ? "Cuisine — Sur note de chambre"
            : "Nouvelle commande cuisine"
          : onNote
            ? "Imputée à la note"
            : "Commande prête caisse",
        body: `${o.tableLabel ?? "Salle"} · ${o.items.length} article(s)${
          onNote ? " · Sur note" : ""
        }`,
        kind: needsKitchen
          ? "order_sent"
          : onNote
            ? "order_note_chambre"
            : "order_ready",
        href: needsKitchen
          ? `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/cuisine?orderId=${o.id}`
          : onNote
            ? noteHref
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
  const { user } = await ctx(input.organizationId, input.branchId, "restaurant");
  const order = await prisma.hotelOrder.findFirst({
    where: { id: input.orderId, branchId: input.branchId },
  });
  if (!order) throw new Error("Commande introuvable.");

  if (input.to === "ANNULEE") {
    if (order.postedToFolioAt) {
      throw new Error(
        "Commande déjà imputée à la note — annulation impossible (V1).",
      );
    }
  }

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
    // Sur note : impute au folio et clôture la commande (LIVREE)
    if (input.to === "LIVREE") {
      const alreadyPaid =
        order.status === "PAYEE" || order.paidAt != null;
      const wasInKitchen =
        order.status === "ENVOYEE" || order.status === "EN_PREPARATION";
      const onNote = isNoteChambreMode(order.settlementMode);

      if (onNote) {
        await tx.hotelOrder.update({
          where: { id: order.id },
          data: {
            deliveredAt: new Date(),
            readyAt: order.readyAt ?? new Date(),
          },
        });
        await postOrderToFolio(tx, order.id);
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
              body: `${order.tableLabel ?? "Salle"} · livrée · Sur note de chambre`,
              kind: "order_kitchen_bypassed",
              href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/cuisine`,
            },
          });
        }
        await tx.branchNotification.create({
          data: {
            branchId: input.branchId,
            title: "Sur note de chambre",
            body: `${order.tableLabel ?? "Salle"} · consommation imputée à la note`,
            kind: "order_note_chambre",
            href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/sejours`,
          },
        });
        return;
      }

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

    const onNote = isNoteChambreMode(order.settlementMode);
    const href =
      input.to === "PRETE" || input.to === "EN_CAISSE"
        ? onNote
          ? `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/restauration?view=suivi&orderId=${order.id}`
          : `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse?orderId=${order.id}`
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
            : input.to === "PRETE" && onNote
              ? "Prête — Sur note (à livrer)"
              : `Commande ${input.to}`,
        body: `${order.tableLabel ?? "Salle"} · ${order.id.slice(0, 8)}… → ${input.to}${estimateHint}${
          onNote ? " · Sur note" : ""
        }`,
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
  await ctx(organizationId, branchId, "restaurant");
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
      where: {
        branchId,
        status: { in: ["PRETE", "EN_CAISSE"] },
        NOT: { settlementMode: "NOTE_CHAMBRE" },
      },
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
 * Vente rapide caisse.
 * - Comptant : file F&B « en cours » (livrer puis encaisser).
 * - Sur note : impute immédiatement au folio séjour (hors file F&B).
 */
export async function createQuickSaleAction(input: {
  organizationId: string;
  branchId: string;
  items: { menuItemId: string; quantity: number }[];
  tableLabel?: string;
  stayId?: string;
  settlementMode?: OrderSettlementMode;
}) {
  const { user } = await ctx(input.organizationId, input.branchId, "restaurant");
  if (!input.items.length) throw new Error("Panier vide.");

  const settlementMode: OrderSettlementMode =
    input.settlementMode === ORDER_SETTLEMENT.NOTE_CHAMBRE
      ? ORDER_SETTLEMENT.NOTE_CHAMBRE
      : ORDER_SETTLEMENT.COMPTANT;

  let folioId: string | null = null;
  let stayId: string | null = input.stayId?.trim() || null;
  let label = input.tableLabel?.trim() || "Vente rapide";

  if (settlementMode === ORDER_SETTLEMENT.NOTE_CHAMBRE) {
    if (!stayId) {
      throw new Error("Sélectionnez un séjour pour reporter sur la note.");
    }
    const stay = await prisma.hotelStay.findFirst({
      where: {
        id: stayId,
        branchId: input.branchId,
        status: "CHECKED_IN",
      },
      include: { room: true, folio: true },
    });
    if (!stay?.folio || stay.folio.closed) {
      throw new Error("Note de chambre indisponible pour ce séjour.");
    }
    folioId = stay.folio.id;
    label = `Ch. ${stay.room.number} · ${stay.guestName}`;
  } else if (stayId) {
    const stay = await prisma.hotelStay.findFirst({
      where: {
        id: stayId,
        branchId: input.branchId,
        status: "CHECKED_IN",
      },
      include: { room: true },
    });
    if (!stay) throw new Error("Séjour introuvable.");
    if (!input.tableLabel?.trim()) {
      label = `Ch. ${stay.room.number} · ${stay.guestName}`;
    }
  }

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
  const onNote = settlementMode === ORDER_SETTLEMENT.NOTE_CHAMBRE;
  const now = new Date();

  const order = await prisma.$transaction(async (tx) => {
    await consumeMenuStock(tx, input.branchId, input.items);

    const o = await tx.hotelOrder.create({
      data: {
        branchId: input.branchId,
        stayId,
        folioId,
        tableLabel: label,
        settlementMode,
        status: onNote ? "LIVREE" : "EN_CAISSE",
        createdByUserId: user.id,
        sentAt: now,
        readyAt: now,
        deliveredAt: onNote ? now : null,
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

    if (onNote) {
      await postOrderToFolio(tx, o.id);
    }

    await tx.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: onNote
          ? "Vente rapide — Sur note de chambre"
          : "Vente rapide — en cours caisse",
        body: `${label} · ${o.items.length} article(s)${
          onNote ? " · Sur note" : ""
        }`,
        kind: onNote ? "order_note_chambre" : "order_en_caisse",
        href: onNote
          ? `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse?tab=folios`
          : `/admin/organizations/${input.organizationId}/branches/${input.branchId}/caisse?orderId=${o.id}`,
      },
    });

    return o;
  });

  revalidateHotel(input.organizationId, input.branchId);
  return { ...order, settlementMode, onNote };
}
