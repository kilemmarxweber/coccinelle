import prisma from "@/lib/prisma";
import {
  TABLE_RESERVATION_SLOT_MINUTES,
  tableReservationSlotEnd,
} from "@/lib/hotel/table-reservation-status";

export type AvailableTableOption = {
  id: string;
  number: string;
  capacity: number;
};

/**
 * Tables libres pour un créneau : capacité OK, pas HS, pas de
 * réservation CONFIRMED chevauchante.
 */
export async function listAvailableTablesForSlot(params: {
  branchId: string;
  startsAt: Date;
  covers: number;
  excludeReservationId?: string;
}): Promise<AvailableTableOption[]> {
  const { branchId, startsAt, covers, excludeReservationId } = params;
  const slotEnd = tableReservationSlotEnd(startsAt);
  const slotStartFloor = new Date(
    startsAt.getTime() - TABLE_RESERVATION_SLOT_MINUTES * 60 * 1000,
  );

  const tables = await prisma.hotelRestaurantTable.findMany({
    where: {
      branchId,
      capacity: { gte: covers },
      status: { not: "OUT_OF_SERVICE" },
    },
    orderBy: [{ capacity: "asc" }, { number: "asc" }],
    select: { id: true, number: true, capacity: true },
  });
  if (tables.length === 0) return [];

  const overlapping = await prisma.hotelTableReservation.findMany({
    where: {
      branchId,
      status: "CONFIRMED",
      tableId: { not: null },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      startsAt: {
        gt: slotStartFloor,
        lt: slotEnd,
      },
    },
    select: { id: true, tableId: true, startsAt: true },
  });

  const busyTableIds = new Set<string>();
  for (const row of overlapping) {
    if (!row.tableId) continue;
    const rowEnd = tableReservationSlotEnd(row.startsAt);
    if (row.startsAt < slotEnd && rowEnd > startsAt) {
      busyTableIds.add(row.tableId);
    }
  }

  return tables.filter((t) => !busyTableIds.has(t.id));
}

/** Auto-assigne la plus petite table disponible (capacité minimale). */
export async function pickAutoAssignTable(params: {
  branchId: string;
  startsAt: Date;
  covers: number;
}): Promise<AvailableTableOption | null> {
  const available = await listAvailableTablesForSlot(params);
  return available[0] ?? null;
}
