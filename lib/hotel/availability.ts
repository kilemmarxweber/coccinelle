/**
 * Disponibilité chambre par type pour des dates données.
 * Capacité = chambres non hors service − séjours BOOKED/IN_HOUSE qui chevauchent.
 */

import { nightsBetween, parseDateOnlyInput } from "@/lib/hotel/folio-nights";
import prisma from "@/lib/prisma";

/** Half-open overlap: [aStart, aEnd) ∩ [bStart, bEnd) ≠ ∅ */
export function datesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}

export type AvailableRoomType = {
  roomTypeId: string;
  name: string;
  description: string | null;
  capacity: number;
  priceNight: number;
  nights: number;
  totalAmount: number;
  bookableRooms: number;
  overlappingStays: number;
  availableCount: number;
};

export async function listAvailableRoomTypes(input: {
  branchId: string;
  checkInDate: Date;
  checkOutDate: Date;
}): Promise<AvailableRoomType[]> {
  const nights = nightsBetween(input.checkInDate, input.checkOutDate);
  if (nights < 1) return [];

  const roomTypes = await prisma.hotelRoomType.findMany({
    where: { branchId: input.branchId },
    orderBy: { priceNight: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      capacity: true,
      priceNight: true,
      rooms: {
        where: { status: { not: "OUT_OF_ORDER" } },
        select: { id: true },
      },
      stays: {
        where: {
          status: { in: ["BOOKED", "IN_HOUSE"] },
          checkInDate: { lt: input.checkOutDate },
          checkOutDate: { gt: input.checkInDate },
        },
        select: { id: true },
      },
    },
  });

  return roomTypes
    .map((rt) => {
      const bookableRooms = rt.rooms.length;
      const overlappingStays = rt.stays.length;
      const availableCount = Math.max(0, bookableRooms - overlappingStays);
      return {
        roomTypeId: rt.id,
        name: rt.name,
        description: rt.description,
        capacity: rt.capacity,
        priceNight: rt.priceNight,
        nights,
        totalAmount: nights * rt.priceNight,
        bookableRooms,
        overlappingStays,
        availableCount,
      };
    })
    .filter((rt) => rt.bookableRooms > 0);
}

export async function assertRoomTypeAvailable(input: {
  branchId: string;
  roomTypeId: string;
  checkInDate: Date;
  checkOutDate: Date;
}): Promise<{ ok: true; availableCount: number; priceNight: number } | { ok: false; error: string }> {
  const types = await listAvailableRoomTypes({
    branchId: input.branchId,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
  });
  const match = types.find((t) => t.roomTypeId === input.roomTypeId);
  if (!match) {
    return { ok: false, error: "Type de chambre introuvable." };
  }
  if (match.availableCount < 1) {
    return {
      ok: false,
      error: "Plus de disponibilité pour ces dates.",
    };
  }
  return {
    ok: true,
    availableCount: match.availableCount,
    priceNight: match.priceNight,
  };
}

export function parseBookingDateRange(
  checkInRaw: string,
  checkOutRaw: string,
):
  | { ok: true; checkInDate: Date; checkOutDate: Date; nights: number }
  | { ok: false; error: string } {
  const checkInDate = parseDateOnlyInput(checkInRaw);
  const checkOutDate = parseDateOnlyInput(checkOutRaw);
  if (!checkInDate || !checkOutDate) {
    return { ok: false, error: "Dates invalides." };
  }
  const nights = nightsBetween(checkInDate, checkOutDate);
  if (nights < 1) {
    return {
      ok: false,
      error: "Le départ doit être après l’arrivée (au moins une nuit).",
    };
  }
  return { ok: true, checkInDate, checkOutDate, nights };
}
