"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { assertHospitalityModule } from "@/lib/branch/hospitality";
import { branchBasePath } from "@/lib/branch/paths";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/prisma/client";
import {
  getActiveExchangeRate,
  getOpenCashSession,
} from "@/lib/cash/actions";
import { assertIndividualGuestId } from "@/lib/hotel/guest-id-document";
import {
  STAY_BILLING,
  assertStayRateInput,
  isNegotiatedNightRate,
  nightlyStayDescription,
} from "@/lib/hotel/stay-rate";
import { nightsBetween } from "@/lib/hotel/stay-nights";
import {
  buildStayGroupInvoice,
  type StayGroupInvoice,
} from "@/lib/hotel/stay-group-invoice";
import { renderStayGroupInvoiceHtml } from "@/lib/hotel/stay-group-invoice-print";
import {
  STAY_GROUP_PAYMENT_NOTES,
  stayGroupSettlement,
} from "@/lib/hotel/stay-group-settlement";
import { folioPaidTowardBalance } from "@/lib/hotel/meeting-deposit";

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
  assertHospitalityModule(branch, "stays");
  return { user: session.user, branch };
}

function revalidate(organizationId: string, branchId: string) {
  const base = branchBasePath(organizationId, branchId);
  revalidatePath(`${base}/hotel/sejours`);
  revalidatePath(`${base}/hotel/partenaires`);
  revalidatePath(`${base}/caisse`);
  revalidatePath(base);
}

function parseDay(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

async function roomsFreeForPeriod(
  tx: Prisma.TransactionClient,
  branchId: string,
  roomIds: string[],
  checkIn: Date,
  checkOut: Date,
) {
  if (roomIds.length === 0) return;
  const clash = await tx.hotelStay.findFirst({
    where: {
      branchId,
      roomId: { in: roomIds },
      status: { in: ["RESERVED", "CHECKED_IN"] },
      checkInDate: { lt: checkOut },
      checkOutDate: { gt: checkIn },
    },
    select: { roomId: true, room: { select: { number: true } } },
  });
  if (clash) {
    throw new Error(
      `Chambre ${clash.room.number} déjà réservée sur ces dates.`,
    );
  }
}

export type StayGroupLineInput =
  | { roomId: string }
  | { roomTypeId: string; quantity: number };

/** Crée un dossier GRP-/PRT- + N stays (guestPending) atomiquement. */
export async function createStayGroupAction(input: {
  organizationId: string;
  branchId: string;
  checkInDate: string;
  checkOutDate: string;
  lines: StayGroupLineInput[];
  partnerId?: string | null;
  bookerName?: string | null;
  bookerPhone?: string | null;
  bookerEmail?: string | null;
  label?: string | null;
  notes?: string | null;
  payTiming?: "PREPAID" | "AT_CHECKOUT";
  /** Acompte global optionnel (PREPAID) — ventilé sur les folios */
  depositPaymentUsd?: number | null;
  paymentMethod?: "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK";
  bankReference?: string | null;
}): Promise<{ bookingId: string; code: string; stayIds: string[] }> {
  const { user } = await ctx(input.organizationId, input.branchId);
  const checkIn = parseDay(input.checkInDate);
  const checkOut = parseDay(input.checkOutDate);
  if (!(checkOut.getTime() > checkIn.getTime())) {
    throw new Error("La date de sortie doit être après l’entrée.");
  }
  const today = new Date();
  const todayUtc = new Date(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
  );
  if (checkIn.getTime() < todayUtc.getTime()) {
    throw new Error("Date d’entrée dans le passé.");
  }
  if (!input.lines?.length) {
    throw new Error("Ajoutez au moins une chambre.");
  }

  const partnerId = input.partnerId?.trim() || null;
  const bookerName = input.bookerName?.trim() || null;
  if (!partnerId && !bookerName) {
    throw new Error("Indiquez un partenaire ou le nom du booker.");
  }
  if (partnerId) {
    const partner = await prisma.branchPartner.findFirst({
      where: { id: partnerId, branchId: input.branchId, status: "ACTIVE" },
    });
    if (!partner) throw new Error("Partenaire introuvable ou inactif.");
    if (!partner.address?.trim() || !partner.city?.trim()) {
      throw new Error("Adresse partenaire incomplète.");
    }
  }

  const payTiming =
    input.payTiming === "PREPAID" ? "PREPAID" : "AT_CHECKOUT";
  const depositUsd = Math.max(0, Number(input.depositPaymentUsd ?? 0) || 0);
  let cashSessionId: string | null = null;
  let exchangeRate: number | null = null;
  let foreignCurrency = "USD";
  if (depositUsd > 0.01) {
    const cashSession = await getOpenCashSession(input.branchId);
    if (!cashSession) {
      throw new Error("Ouvrez une session de caisse pour l’acompte dossier.");
    }
    cashSessionId = cashSession.id;
    const rate = await getActiveExchangeRate(input.branchId);
    exchangeRate = rate?.rate ?? null;
    foreignCurrency = rate?.fromCurrency ?? "USD";
  }

  const nights = nightsBetween(checkIn, checkOut);
  const result = await prisma.$transaction(async (tx) => {
    const resolvedRoomIds: string[] = [];
    for (const line of input.lines) {
      if ("roomId" in line && line.roomId) {
        resolvedRoomIds.push(line.roomId);
        continue;
      }
      if ("roomTypeId" in line && line.roomTypeId) {
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 0));
        const candidates = await tx.hotelRoom.findMany({
          where: {
            roomTypeId: line.roomTypeId,
            roomType: { branchId: input.branchId, kind: "ROOM" },
            status: { not: "OUT_OF_ORDER" },
            id: { notIn: resolvedRoomIds },
          },
          orderBy: { number: "asc" },
        });
        const free: string[] = [];
        for (const room of candidates) {
          if (free.length >= qty) break;
          const clash = await tx.hotelStay.findFirst({
            where: {
              roomId: room.id,
              status: { in: ["RESERVED", "CHECKED_IN"] },
              checkInDate: { lt: checkOut },
              checkOutDate: { gt: checkIn },
            },
            select: { id: true },
          });
          if (!clash) free.push(room.id);
        }
        if (free.length < qty) {
          const type = await tx.hotelRoomType.findFirst({
            where: { id: line.roomTypeId, branchId: input.branchId },
            select: { name: true },
          });
          throw new Error(
            `Pas assez de chambres libres (${type?.name ?? "type"}) : ${free.length}/${qty}.`,
          );
        }
        resolvedRoomIds.push(...free);
      }
    }
    if (resolvedRoomIds.length === 0) {
      throw new Error("Aucune chambre à réserver.");
    }
    const unique = new Set(resolvedRoomIds);
    if (unique.size !== resolvedRoomIds.length) {
      throw new Error("Chambre en double dans la sélection.");
    }
    await roomsFreeForPeriod(
      tx,
      input.branchId,
      resolvedRoomIds,
      checkIn,
      checkOut,
    );

    const rooms = await tx.hotelRoom.findMany({
      where: {
        id: { in: resolvedRoomIds },
        roomType: { branchId: input.branchId, kind: "ROOM" },
      },
      include: { roomType: true },
    });
    if (rooms.length !== resolvedRoomIds.length) {
      throw new Error("Une ou plusieurs chambres sont invalides.");
    }
    const byId = new Map(rooms.map((r) => [r.id, r]));

    const prefix = partnerId ? "PRT" : "GRP";
    const count = await tx.partnerBooking.count({
      where: { branchId: input.branchId },
    });
    const code = `${prefix}-${String(count + 1).padStart(5, "0")}`;
    const booking = await tx.partnerBooking.create({
      data: {
        branchId: input.branchId,
        partnerId,
        code,
        label: input.label?.trim() || null,
        notes: input.notes?.trim() || null,
        payTiming,
        status: "CONFIRMED",
        bookerName: partnerId ? bookerName : bookerName!,
        bookerPhone: input.bookerPhone?.trim() || null,
        bookerEmail: input.bookerEmail?.trim() || null,
        createdByUserId: user.id,
      },
    });

    const stayIds: string[] = [];
    const folioIds: string[] = [];
    const placeholder =
      bookerName?.trim() ||
      (partnerId ? "Occupant partenaire" : "À identifier");

    for (const roomId of resolvedRoomIds) {
      const room = byId.get(roomId)!;
      const catalogUnitPrice = room.roomType.priceNight;
      assertStayRateInput({
        billingMode: STAY_BILLING.NIGHTLY,
        catalogUnitPrice,
        unitPriceApplied: null,
        flatAmount: null,
        plannedHours: null,
      });
      const appliedUnit = catalogUnitPrice;
      const nightAmount = nights * appliedUnit;
      const s = await tx.hotelStay.create({
        data: {
          branchId: input.branchId,
          roomId: room.id,
          guestName: `${placeholder} · ch. ${room.number}`,
          guestPhone: input.bookerPhone?.trim() || null,
          guestAddress: null,
          guestCity: null,
          guestPending: true,
          partnerId,
          partnerBookingId: booking.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          adults: 1,
          notes: input.notes?.trim() || null,
          status: "RESERVED",
          billingMode: STAY_BILLING.NIGHTLY,
          catalogUnitPrice,
          unitPriceApplied: null,
        },
      });
      stayIds.push(s.id);
      const folio = await tx.folio.create({
        data: {
          branchId: input.branchId,
          stayId: s.id,
          label: `Séjour groupe · ch. ${room.number}`,
          lines: {
            create: [
              {
                kind: "NIGHT",
                description: nightlyStayDescription({
                  nights,
                  roomNumber: room.number,
                  roomTypeName: room.roomType.name,
                  negotiated: false,
                  catalogUnitPrice,
                  unitPriceApplied: appliedUnit,
                  rateNote: null,
                }),
                quantity: nights,
                unitPrice: appliedUnit,
                amount: nightAmount,
              },
            ],
          },
        },
      });
      folioIds.push(folio.id);
    }

    if (cashSessionId && depositUsd > 0.01 && folioIds.length > 0) {
      const rateVal = exchangeRate && exchangeRate > 0 ? exchangeRate : 1;
      const method = input.paymentMethod ?? "CASH";
      const bankReference = input.bankReference?.trim() || null;
      const shares = splitAmount(depositUsd, folioIds.length);
      let payCount = await tx.payment.count({
        where: { branchId: input.branchId },
      });
      for (let i = 0; i < folioIds.length; i++) {
        const share = shares[i]!;
        if (share < 0.005) continue;
        payCount += 1;
        await tx.payment.create({
          data: {
            branchId: input.branchId,
            cashSessionId,
            folioId: folioIds[i]!,
            partnerId,
            partnerBookingId: booking.id,
            receiptNumber: `RC-${String(payCount).padStart(5, "0")}`,
            method,
            amountCdf: share * rateVal,
            amountForeign: share,
            foreignCurrency,
            exchangeRateUsed: exchangeRate,
            bankReference: method === "BANK" ? bankReference : null,
            cashierUserId: user.id,
            note: "Acompte dossier groupe",
          },
        });
      }
    }

    await tx.branchNotification.create({
      data: {
        branchId: input.branchId,
        title: "Réservation groupée",
        body: `${booking.code} · ${stayIds.length} chambre(s) · ${input.checkInDate}`,
        kind: "stay_reserved",
        href: `/admin/organizations/${input.organizationId}/branches/${input.branchId}/hotel/sejours`,
      },
    });

    return { bookingId: booking.id, code: booking.code, stayIds };
  });

  revalidate(input.organizationId, input.branchId);
  return result;
}

function splitAmount(total: number, n: number): number[] {
  if (n <= 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rem = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rem ? 1 : 0)) / 100);
}

/** Complète l’identité de l’occupant d’une chambre du dossier. */
export async function completeStayGuestAction(input: {
  organizationId: string;
  branchId: string;
  stayId: string;
  guestName: string;
  guestPhone?: string | null;
  guestAddress: string;
  guestCity: string;
  idDocumentType: string;
  idDocumentNumber: string;
  idDocumentImageUrl: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const stay = await prisma.hotelStay.findFirst({
    where: { id: input.stayId, branchId: input.branchId },
  });
  if (!stay) throw new Error("Séjour introuvable.");
  if (stay.status === "CANCELLED" || stay.status === "CHECKED_OUT") {
    throw new Error("Séjour non modifiable.");
  }
  const name = input.guestName.trim();
  if (!name) throw new Error("Nom de l’occupant obligatoire.");
  const guestAddress = input.guestAddress.trim();
  const guestCity = input.guestCity.trim();
  if (!guestAddress || !guestCity) {
    throw new Error("Adresse de l’occupant obligatoire.");
  }
  const guestId = assertIndividualGuestId({
    idDocumentType: input.idDocumentType,
    idDocumentNumber: input.idDocumentNumber,
    idDocumentImageUrl: input.idDocumentImageUrl,
  });
  await prisma.hotelStay.update({
    where: { id: stay.id },
    data: {
      guestName: name,
      guestPhone: input.guestPhone?.trim() || null,
      guestAddress,
      guestCity,
      idDocumentType: guestId.idDocumentType,
      idDocumentNumber: guestId.idDocumentNumber,
      idDocumentImageUrl: guestId.idDocumentImageUrl,
      idDocumentCapturedAt: new Date(),
      guestPending: false,
    },
  });
  revalidate(input.organizationId, input.branchId);
}

export async function checkInStayGroupBatchAction(input: {
  organizationId: string;
  branchId: string;
  stayIds: string[];
}) {
  await ctx(input.organizationId, input.branchId);
  if (!input.stayIds.length) throw new Error("Sélectionnez des chambres.");
  const stays = await prisma.hotelStay.findMany({
    where: {
      id: { in: input.stayIds },
      branchId: input.branchId,
    },
  });
  if (stays.length !== input.stayIds.length) {
    throw new Error("Un séjour est introuvable.");
  }
  for (const s of stays) {
    if (s.status !== "RESERVED") {
      throw new Error(`Check-in impossible pour ${s.guestName}.`);
    }
    if (s.guestPending) {
      throw new Error(
        `Identité manquante · ch. liée à ${s.guestName} — complétez avant check-in.`,
      );
    }
    if (!s.guestAddress?.trim() || !s.idDocumentNumber?.trim()) {
      throw new Error(`Identité incomplète pour ${s.guestName}.`);
    }
  }
  const now = new Date();
  const bookingIds = [
    ...new Set(
      stays.map((s) => s.partnerBookingId).filter(Boolean) as string[],
    ),
  ];
  await prisma.$transaction(async (tx) => {
    for (const s of stays) {
      await tx.hotelStay.update({
        where: { id: s.id },
        data: { status: "CHECKED_IN", checkedInAt: now },
      });
      await tx.hotelRoom.update({
        where: { id: s.roomId },
        data: { status: "OCCUPIED" },
      });
    }
    for (const bid of bookingIds) {
      await tx.partnerBooking.update({
        where: { id: bid },
        data: { status: "IN_HOUSE" },
      });
    }
  });
  revalidate(input.organizationId, input.branchId);
}

/** Annule une chambre du dossier ; les autres restent. Void les charges si pas check-in. */
export async function cancelStayInGroupAction(input: {
  organizationId: string;
  branchId: string;
  stayId: string;
}): Promise<{
  settlement: ReturnType<typeof stayGroupSettlement>;
}> {
  await ctx(input.organizationId, input.branchId);
  const stay = await prisma.hotelStay.findFirst({
    where: { id: input.stayId, branchId: input.branchId },
    include: {
      folio: { include: { lines: true } },
      partnerBooking: { include: { stays: true } },
    },
  });
  if (!stay) throw new Error("Séjour introuvable.");
  if (stay.status === "CHECKED_IN") {
    throw new Error("Check-out d’abord (chambre occupée).");
  }
  if (stay.status === "CANCELLED") {
    const settlement = await loadBookingSettlement(stay.partnerBookingId);
    return { settlement };
  }
  if (stay.status !== "RESERVED" && stay.status !== "NO_SHOW") {
    throw new Error("Annulation impossible pour ce statut.");
  }
  if (!stay.partnerBookingId) {
    throw new Error("Séjour hors dossier groupe.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.hotelStay.update({
      where: { id: stay.id },
      data: { status: "CANCELLED" },
    });
    // Chambre non check-in : annuler les charges (nuitées) — les paiements restent au dossier
    if (stay.folio) {
      for (const line of stay.folio.lines) {
        if (Math.abs(line.amount) < 0.005) continue;
        await tx.folioLine.update({
          where: { id: line.id },
          data: {
            description: `${STAY_GROUP_PAYMENT_NOTES.cancelCredit} · ${line.description}`,
            quantity: 0,
            unitPrice: 0,
            amount: 0,
          },
        });
      }
      await tx.folio.update({
        where: { id: stay.folio.id },
        data: { closed: true, checkoutQueuedAt: null },
      });
    }
    if (stay.partnerBooking) {
      const siblings = stay.partnerBooking.stays.filter((s) => s.id !== stay.id);
      const allCancelled = siblings.every(
        (s) => s.status === "CANCELLED" || s.status === "NO_SHOW",
      );
      if (allCancelled) {
        await tx.partnerBooking.update({
          where: { id: stay.partnerBookingId! },
          data: { status: "CANCELLED" },
        });
      }
    }
  });

  const settlement = await loadBookingSettlement(stay.partnerBookingId);
  revalidate(input.organizationId, input.branchId);
  return { settlement };
}

/** Annulation partielle multi-chambres (sélection). */
export async function cancelStayGroupBatchAction(input: {
  organizationId: string;
  branchId: string;
  stayIds: string[];
}): Promise<{
  cancelled: number;
  settlement: ReturnType<typeof stayGroupSettlement>;
}> {
  await ctx(input.organizationId, input.branchId);
  if (!input.stayIds.length) throw new Error("Sélectionnez des chambres.");
  let cancelled = 0;
  let bookingId: string | null = null;
  for (const stayId of input.stayIds) {
    const res = await cancelStayInGroupAction({
      organizationId: input.organizationId,
      branchId: input.branchId,
      stayId,
    });
    cancelled += 1;
    // settlement always from last; load final below
    void res;
  }
  const stay = await prisma.hotelStay.findFirst({
    where: { id: input.stayIds[0], branchId: input.branchId },
    select: { partnerBookingId: true },
  });
  bookingId = stay?.partnerBookingId ?? null;
  const settlement = await loadBookingSettlement(bookingId);
  return { cancelled, settlement };
}

async function loadBookingSettlement(partnerBookingId: string | null) {
  if (!partnerBookingId) {
    return stayGroupSettlement([]);
  }
  const booking = await prisma.partnerBooking.findFirst({
    where: { id: partnerBookingId },
    include: {
      stays: {
        include: {
          room: { select: { number: true } },
          folio: { include: { lines: true, payments: true } },
        },
      },
    },
  });
  if (!booking) return stayGroupSettlement([]);
  return stayGroupSettlement(
    booking.stays.map((s) => ({
      id: s.id,
      status: s.status,
      guestName: s.guestName,
      room: s.room,
      folio: s.folio
        ? {
            id: s.folio.id,
            closed: s.folio.closed,
            lines: s.folio.lines,
            payments: s.folio.payments,
          }
        : null,
    })),
  );
}

export async function listStayGroupsAction(
  organizationId: string,
  branchId: string,
) {
  await ctx(organizationId, branchId);
  return prisma.partnerBooking.findMany({
    where: {
      branchId,
      status: { not: "CANCELLED" },
    },
    include: {
      partner: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          phone: true,
          email: true,
          taxId: true,
        },
      },
      stays: {
        where: { status: { not: "CANCELLED" } },
        include: {
          room: { include: { roomType: { select: { name: true } } } },
        },
        orderBy: { room: { number: "asc" } },
      },
      _count: { select: { stays: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
}

export async function getStayGroupDetailAction(
  organizationId: string,
  branchId: string,
  bookingId: string,
) {
  await ctx(organizationId, branchId);
  const booking = await prisma.partnerBooking.findFirst({
    where: { id: bookingId, branchId },
    include: {
      partner: true,
      stays: {
        include: {
          room: { include: { roomType: true } },
          folio: { include: { lines: true, payments: true } },
        },
        orderBy: { room: { number: "asc" } },
      },
      payments: {
        orderBy: { paidAt: "desc" },
        take: 50,
      },
    },
  });
  if (!booking) throw new Error("Dossier introuvable.");
  return booking;
}

/** Acompte / paiement dossier ventilé au prorata des charges folio. */
export async function recordStayGroupPaymentAction(input: {
  organizationId: string;
  branchId: string;
  bookingId: string;
  amountUsd: number;
  paymentMethod?: "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK";
  bankReference?: string | null;
  note?: string | null;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const amount = Number(input.amountUsd);
  if (!(amount > 0)) throw new Error("Montant invalide.");
  const booking = await prisma.partnerBooking.findFirst({
    where: { id: input.bookingId, branchId: input.branchId },
    include: {
      stays: {
        where: { status: { notIn: ["CANCELLED", "NO_SHOW"] } },
        include: { folio: { include: { lines: true } } },
      },
    },
  });
  if (!booking) throw new Error("Dossier introuvable.");
  const targets = booking.stays
    .filter((s) => s.folio)
    .map((s) => {
      const charges = (s.folio!.lines ?? [])
        .filter((l) => l.kind !== "DEPOSIT")
        .reduce((sum, l) => sum + l.amount, 0);
      return { folioId: s.folio!.id, charges: Math.max(0, charges) };
    });
  if (!targets.length) throw new Error("Aucun folio actif sur ce dossier.");
  const cashSession = await getOpenCashSession(input.branchId);
  if (!cashSession) {
    throw new Error("Ouvrez une session de caisse.");
  }
  const rate = await getActiveExchangeRate(input.branchId);
  const exchangeRate = rate?.rate ?? null;
  const foreignCurrency = rate?.fromCurrency ?? "USD";
  const rateVal = exchangeRate && exchangeRate > 0 ? exchangeRate : 1;
  const totalCharges = targets.reduce((s, t) => s + t.charges, 0);
  const method = input.paymentMethod ?? "CASH";
  const bankReference = input.bankReference?.trim() || null;
  const note = input.note?.trim() || STAY_GROUP_PAYMENT_NOTES.payment;

  await prisma.$transaction(async (tx) => {
    let payCount = await tx.payment.count({
      where: { branchId: input.branchId },
    });
    let remainingCents = Math.round(amount * 100);
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]!;
      let shareCents: number;
      if (totalCharges <= 0) {
        shareCents =
          i === targets.length - 1
            ? remainingCents
            : Math.floor(remainingCents / (targets.length - i));
      } else if (i === targets.length - 1) {
        shareCents = remainingCents;
      } else {
        shareCents = Math.round((amount * 100 * t.charges) / totalCharges);
        shareCents = Math.min(shareCents, remainingCents);
      }
      remainingCents -= shareCents;
      const share = shareCents / 100;
      if (share < 0.005) continue;
      payCount += 1;
      await tx.payment.create({
        data: {
          branchId: input.branchId,
          cashSessionId: cashSession.id,
          folioId: t.folioId,
          partnerId: booking.partnerId,
          partnerBookingId: booking.id,
          receiptNumber: `RC-${String(payCount).padStart(5, "0")}`,
          method,
          amountCdf: share * rateVal,
          amountForeign: share,
          foreignCurrency,
          exchangeRateUsed: exchangeRate,
          bankReference: method === "BANK" ? bankReference : null,
          cashierUserId: user.id,
          note,
        },
      });
    }
  });
  revalidate(input.organizationId, input.branchId);
}

/**
 * Rembourse un trop-perçu dossier (après annulation / conso inférieure au prépayé).
 * `amountUsd` = montant positif à rendre.
 */
export async function recordStayGroupRefundAction(input: {
  organizationId: string;
  branchId: string;
  bookingId: string;
  amountUsd: number;
  paymentMethod?: "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK";
  bankReference?: string | null;
  note?: string | null;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const amount = Number(input.amountUsd);
  if (!(amount > 0.01)) throw new Error("Montant de remboursement invalide.");

  const booking = await prisma.partnerBooking.findFirst({
    where: { id: input.bookingId, branchId: input.branchId },
    include: {
      stays: {
        include: {
          room: { select: { number: true } },
          folio: { include: { lines: true, payments: true } },
        },
      },
    },
  });
  if (!booking) throw new Error("Dossier introuvable.");

  const settlement = stayGroupSettlement(
    booking.stays.map((s) => ({
      id: s.id,
      status: s.status,
      guestName: s.guestName,
      room: s.room,
      folio: s.folio
        ? {
            id: s.folio.id,
            closed: s.folio.closed,
            lines: s.folio.lines,
            payments: s.folio.payments,
          }
        : null,
    })),
  );
  if (settlement.refundDue < 0.01) {
    throw new Error("Aucun trop-perçu à rembourser sur ce dossier.");
  }
  if (amount > settlement.refundDue + 0.02) {
    throw new Error(
      `Remboursement max. ${settlement.refundDue.toFixed(2)} $ (solde actuel).`,
    );
  }

  const targets = booking.stays
    .filter((s) => s.folio)
    .map((s) => {
      const paid = folioPaidTowardBalance(s.folio!.payments);
      return { folioId: s.folio!.id, paid: Math.max(0, paid) };
    })
    .filter((t) => t.paid > 0.005);
  if (!targets.length) {
    // Fallback : premier folio du dossier
    const any = booking.stays.find((s) => s.folio);
    if (!any?.folio) throw new Error("Aucun folio pour le remboursement.");
    targets.push({ folioId: any.folio.id, paid: amount });
  }

  const cashSession = await getOpenCashSession(input.branchId);
  if (!cashSession) {
    throw new Error("Ouvrez une session de caisse pour rembourser.");
  }
  const rate = await getActiveExchangeRate(input.branchId);
  const exchangeRate = rate?.rate ?? null;
  const foreignCurrency = rate?.fromCurrency ?? "USD";
  const rateVal = exchangeRate && exchangeRate > 0 ? exchangeRate : 1;
  const method = input.paymentMethod ?? "CASH";
  const bankReference = input.bankReference?.trim() || null;
  const note =
    input.note?.trim() || STAY_GROUP_PAYMENT_NOTES.refund;
  const totalPaidBase = targets.reduce((s, t) => s + t.paid, 0);

  await prisma.$transaction(async (tx) => {
    let payCount = await tx.payment.count({
      where: { branchId: input.branchId },
    });
    let remainingCents = Math.round(amount * 100);
    for (let i = 0; i < targets.length; i++) {
      const t = targets[i]!;
      let shareCents: number;
      if (i === targets.length - 1) {
        shareCents = remainingCents;
      } else {
        shareCents = Math.round((amount * 100 * t.paid) / totalPaidBase);
        shareCents = Math.min(shareCents, remainingCents);
      }
      remainingCents -= shareCents;
      const share = shareCents / 100;
      if (share < 0.005) continue;
      payCount += 1;
      await tx.payment.create({
        data: {
          branchId: input.branchId,
          cashSessionId: cashSession.id,
          folioId: t.folioId,
          partnerId: booking.partnerId,
          partnerBookingId: booking.id,
          receiptNumber: `RC-${String(payCount).padStart(5, "0")}`,
          method,
          amountCdf: -share * rateVal,
          amountForeign: -share,
          foreignCurrency,
          exchangeRateUsed: exchangeRate,
          bankReference: method === "BANK" ? bankReference : null,
          cashierUserId: user.id,
          note,
        },
      });
    }
  });
  revalidate(input.organizationId, input.branchId);
}

async function loadBookingForInvoice(branchId: string, bookingId: string) {
  const booking = await prisma.partnerBooking.findFirst({
    where: { id: bookingId, branchId },
    include: {
      partner: true,
      stays: {
        where: { status: { not: "NO_SHOW" } },
        include: {
          room: { include: { roomType: true } },
          folio: { include: { lines: true, payments: true } },
        },
        orderBy: { room: { number: "asc" } },
      },
    },
  });
  if (!booking) throw new Error("Dossier introuvable.");
  return booking;
}

export async function getStayGroupInvoiceAction(
  organizationId: string,
  branchId: string,
  bookingId: string,
): Promise<StayGroupInvoice> {
  await ctx(organizationId, branchId);
  return buildStayGroupInvoice(await loadBookingForInvoice(branchId, bookingId));
}

/** Négocie le P.U. nuitée d’une chambre du dossier et met à jour la ligne folio. */
export async function updateStayGroupRoomRateAction(input: {
  organizationId: string;
  branchId: string;
  stayId: string;
  unitPriceAppliedUsd: number;
  rateNote?: string | null;
}) {
  const { user } = await ctx(input.organizationId, input.branchId);
  const unit = Number(input.unitPriceAppliedUsd);
  if (!(unit >= 0) || !Number.isFinite(unit)) {
    throw new Error("Montant unitaire invalide.");
  }
  const stay = await prisma.hotelStay.findFirst({
    where: { id: input.stayId, branchId: input.branchId },
    include: {
      room: { include: { roomType: true } },
      folio: { include: { lines: true } },
      partnerBooking: true,
    },
  });
  if (!stay) throw new Error("Séjour introuvable.");
  if (!stay.partnerBookingId) {
    throw new Error("Séjour hors dossier groupe.");
  }
  if (stay.status === "CANCELLED" || stay.status === "CHECKED_OUT") {
    throw new Error("Tarif non modifiable pour ce statut.");
  }
  if (stay.billingMode !== "NIGHTLY") {
    throw new Error("Négociation P.U. disponible pour les nuitées uniquement.");
  }
  if (stay.folio?.closed) {
    throw new Error("Note de chambre clôturée.");
  }

  const nights = nightsBetween(stay.checkInDate, stay.checkOutDate);
  const catalog = stay.catalogUnitPrice;
  const note = input.rateNote?.trim() || stay.rateNote || null;
  assertStayRateInput({
    billingMode: STAY_BILLING.NIGHTLY,
    catalogUnitPrice: catalog,
    unitPriceApplied: unit,
    flatAmount: null,
    plannedHours: null,
    rateNote: note,
  });
  const negotiated = isNegotiatedNightRate({
    catalogUnitPrice: catalog,
    unitPriceApplied: unit,
  });
  const amount = nights * unit;
  const description = nightlyStayDescription({
    nights,
    roomNumber: stay.room.number,
    roomTypeName: stay.room.roomType.name,
    negotiated,
    catalogUnitPrice: catalog,
    unitPriceApplied: unit,
    rateNote: note,
  });

  await prisma.$transaction(async (tx) => {
    await tx.hotelStay.update({
      where: { id: stay.id },
      data: {
        unitPriceApplied: unit,
        rateNote: note,
        negotiatedByUserId: negotiated ? user.id : stay.negotiatedByUserId,
      },
    });
    if (!stay.folio) return;
    const nightLine = stay.folio.lines.find((l) => l.kind === "NIGHT");
    if (nightLine) {
      await tx.folioLine.update({
        where: { id: nightLine.id },
        data: {
          description,
          quantity: nights,
          unitPrice: unit,
          amount,
        },
      });
    } else {
      await tx.folioLine.create({
        data: {
          folioId: stay.folio.id,
          kind: "NIGHT",
          description,
          quantity: nights,
          unitPrice: unit,
          amount,
        },
      });
    }
  });
  revalidate(input.organizationId, input.branchId);
}

/** Aperçu facture (proforma ou réimpression) — récupérable avant archivage. */
export async function previewStayGroupInvoiceAction(input: {
  organizationId: string;
  branchId: string;
  bookingId: string;
}): Promise<{ html: string; invoice: StayGroupInvoice }> {
  const { user } = await ctx(input.organizationId, input.branchId);
  const booking = await loadBookingForInvoice(
    input.branchId,
    input.bookingId,
  );
  const invoice = buildStayGroupInvoice(booking);
  const html = renderStayGroupInvoiceHtml(invoice, {
    issuerName: user.name ?? user.email ?? "Réception",
    issuerRole: "Gérant / Manager",
  });
  return { html, invoice };
}

export async function issueStayGroupInvoiceAction(input: {
  organizationId: string;
  branchId: string;
  bookingId: string;
}): Promise<{ invoiceNumber: string; html: string }> {
  const { user } = await ctx(input.organizationId, input.branchId);
  const booking = await loadBookingForInvoice(
    input.branchId,
    input.bookingId,
  );

  let invoiceNumber = booking.invoiceNumber;
  if (!invoiceNumber) {
    const count = await prisma.partnerBooking.count({
      where: {
        branchId: input.branchId,
        invoiceNumber: { not: null },
      },
    });
    invoiceNumber = `FAC-GRP-${String(count + 1).padStart(5, "0")}`;
    await prisma.partnerBooking.update({
      where: { id: booking.id },
      data: {
        invoiceNumber,
        invoiceIssuedAt: new Date(),
        invoiceIssuedByUserId: user.id,
      },
    });
  }

  const activeOrDone = booking.stays.filter((s) => s.status !== "CANCELLED");
  const allClosed =
    activeOrDone.length === 0 ||
    activeOrDone.every((s) => s.status === "CHECKED_OUT");
  if (allClosed && booking.status !== "CLOSED" && booking.status !== "CANCELLED") {
    await prisma.partnerBooking.update({
      where: { id: booking.id },
      data: { status: "CLOSED" },
    });
  }

  const invoice = buildStayGroupInvoice({
    ...booking,
    invoiceNumber,
    invoiceIssuedAt: booking.invoiceIssuedAt ?? new Date(),
  });
  const html = renderStayGroupInvoiceHtml(invoice, {
    issuerName: user.name ?? user.email ?? "Réception",
    issuerRole: "Gérant / Manager",
  });
  revalidate(input.organizationId, input.branchId);
  return { invoiceNumber, html };
}

export async function markStayGroupInvoiceHandedOverAction(input: {
  organizationId: string;
  branchId: string;
  bookingId: string;
}) {
  await ctx(input.organizationId, input.branchId);
  const booking = await prisma.partnerBooking.findFirst({
    where: { id: input.bookingId, branchId: input.branchId },
  });
  if (!booking) throw new Error("Dossier introuvable.");
  if (!booking.invoiceNumber) {
    throw new Error("Émettez d’abord la facture globale.");
  }
  await prisma.partnerBooking.update({
    where: { id: booking.id },
    data: { invoiceHandedOverAt: new Date() },
  });
  revalidate(input.organizationId, input.branchId);
}
