import prisma from "@/lib/prisma";
import type { HotelTableReservationStatusValue } from "@/lib/hotel/table-reservation-status";

export type TableReservationLineView = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export type TableReservationView = {
  id: string;
  guestPrenom: string;
  guestNom: string;
  guestPhone: string;
  guestName: string;
  startsAt: Date;
  covers: number;
  status: HotelTableReservationStatusValue;
  notes: string | null;
  tableId: string | null;
  tableNumber: string | null;
  stayId: string | null;
  foodOrderId: string | null;
  foodLines: TableReservationLineView[];
  foodTotal: number;
  createdAt: Date;
};

function guestName(prenom: string, nom: string): string {
  return `${prenom} ${nom}`.trim();
}

export async function listUpcomingTableReservations(
  branchId: string,
  options?: { from?: Date; limit?: number },
): Promise<TableReservationView[]> {
  const from = options?.from ?? new Date();
  const rows = await prisma.hotelTableReservation.findMany({
    where: {
      branchId,
      status: "CONFIRMED",
      startsAt: { gte: from },
    },
    orderBy: [{ startsAt: "asc" }],
    take: options?.limit ?? 100,
    include: {
      table: { select: { number: true } },
      foodOrders: {
        orderBy: { createdAt: "asc" },
        take: 1,
        include: {
          lines: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });

  return rows.map(mapReservationRow);
}

export async function getTableReservationById(
  branchId: string,
  reservationId: string,
): Promise<TableReservationView | null> {
  const row = await prisma.hotelTableReservation.findFirst({
    where: { id: reservationId, branchId },
    include: {
      table: { select: { number: true } },
      foodOrders: {
        orderBy: { createdAt: "asc" },
        take: 1,
        include: {
          lines: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!row) return null;
  return mapReservationRow(row);
}

/** Lecture publique (confirmation client) — scope org via branche. */
export async function getPublicTableReservation(
  organizationId: string,
  reservationId: string,
): Promise<(TableReservationView & { branchName: string }) | null> {
  const row = await prisma.hotelTableReservation.findFirst({
    where: {
      id: reservationId,
      branch: { organizationId, type: "HOTEL" },
    },
    include: {
      branch: { select: { name: true } },
      table: { select: { number: true } },
      foodOrders: {
        orderBy: { createdAt: "asc" },
        take: 1,
        include: {
          lines: { orderBy: { createdAt: "asc" } },
        },
      },
    },
  });
  if (!row) return null;
  return {
    ...mapReservationRow(row),
    branchName: row.branch.name,
  };
}

type ReservationRow = {
  id: string;
  guestPrenom: string;
  guestNom: string;
  guestPhone: string;
  startsAt: Date;
  covers: number;
  status: string;
  notes: string | null;
  tableId: string | null;
  stayId: string | null;
  createdAt: Date;
  table: { number: string } | null;
  foodOrders: Array<{
    id: string;
    lines: Array<{
      id: string;
      name: string;
      unitPrice: number;
      quantity: number;
    }>;
  }>;
};

function mapReservationRow(row: ReservationRow): TableReservationView {
  const foodOrder = row.foodOrders[0] ?? null;
  const foodLines =
    foodOrder?.lines.map((line) => ({
      id: line.id,
      name: line.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
    })) ?? [];
  const foodTotal = foodLines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  return {
    id: row.id,
    guestPrenom: row.guestPrenom,
    guestNom: row.guestNom,
    guestPhone: row.guestPhone,
    guestName: guestName(row.guestPrenom, row.guestNom),
    startsAt: row.startsAt,
    covers: row.covers,
    status: row.status as HotelTableReservationStatusValue,
    notes: row.notes,
    tableId: row.tableId,
    tableNumber: row.table?.number ?? null,
    stayId: row.stayId,
    foodOrderId: foodOrder?.id ?? null,
    foodLines,
    foodTotal,
    createdAt: row.createdAt,
  };
}
