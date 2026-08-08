import prisma from "@/lib/prisma";
import {
  computeBalance,
  roundMoney,
  type HotelPaymentMethod,
} from "@/lib/hotel/payment-method";
import {
  guestDisplayName,
  STAY_LIST_FILTER_STATUSES,
  type HotelStayStatusValue,
  type StayListFilter,
} from "@/lib/hotel/stay-status";
import type { StatutPaiement } from "@/prisma/generated/prisma/client";

export type StayListItem = {
  id: string;
  guestName: string;
  guestPhone: string;
  checkInDate: Date;
  checkOutDate: Date;
  status: HotelStayStatusValue;
  priceNight: number;
  totalAmount: number;
  roomTypeId: string;
  roomTypeName: string;
  roomId: string | null;
  roomNumber: string | null;
};

export type StayFolioLine = {
  id: string;
  label: string;
  amount: number;
  kind: "NIGHT" | "OTHER";
};

export type StayPaymentView = {
  id: string;
  amount: number;
  method: HotelPaymentMethod;
  status: StatutPaiement;
  reference: string | null;
  createdAt: Date;
};

export type StayDetail = StayListItem & {
  guestPrenom: string;
  guestNom: string;
  folioLines: StayFolioLine[];
  payments: StayPaymentView[];
  paidAmount: number;
  balanceAmount: number;
};

export type StayFormOptions = {
  types: Array<{
    id: string;
    name: string;
    priceNight: number;
    rooms: Array<{
      id: string;
      number: string;
      status: string;
      floor: string | null;
    }>;
  }>;
};

export async function listStays(
  branchId: string,
  filter: StayListFilter = "upcoming",
): Promise<StayListItem[]> {
  const status = STAY_LIST_FILTER_STATUSES[filter];
  const rows = await prisma.hotelStay.findMany({
    where: { branchId, status },
    orderBy: [{ checkInDate: "asc" }, { createdAt: "desc" }],
    include: {
      roomType: { select: { id: true, name: true } },
      room: { select: { id: true, number: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    guestName: guestDisplayName(row.guestPrenom, row.guestNom),
    guestPhone: row.guestPhone,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    status: row.status as HotelStayStatusValue,
    priceNight: row.priceNight,
    totalAmount: row.totalAmount,
    roomTypeId: row.roomType.id,
    roomTypeName: row.roomType.name,
    roomId: row.room?.id ?? null,
    roomNumber: row.room?.number ?? null,
  }));
}

export async function getStayDetail(
  branchId: string,
  stayId: string,
): Promise<StayDetail | null> {
  const row = await prisma.hotelStay.findFirst({
    where: { id: stayId, branchId },
    include: {
      roomType: { select: { id: true, name: true } },
      room: { select: { id: true, number: true } },
      folioLines: { orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!row) return null;

  const paidAmount = roundMoney(
    row.payments
      .filter((p) => p.status === "PAYE")
      .reduce((sum, p) => sum + p.amount, 0),
  );

  return {
    id: row.id,
    guestPrenom: row.guestPrenom,
    guestNom: row.guestNom,
    guestName: guestDisplayName(row.guestPrenom, row.guestNom),
    guestPhone: row.guestPhone,
    checkInDate: row.checkInDate,
    checkOutDate: row.checkOutDate,
    status: row.status as HotelStayStatusValue,
    priceNight: row.priceNight,
    totalAmount: row.totalAmount,
    roomTypeId: row.roomType.id,
    roomTypeName: row.roomType.name,
    roomId: row.room?.id ?? null,
    roomNumber: row.room?.number ?? null,
    folioLines: row.folioLines.map((line) => ({
      id: line.id,
      label: line.label,
      amount: line.amount,
      kind: line.kind as "NIGHT" | "OTHER",
    })),
    payments: row.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method as HotelPaymentMethod,
      status: p.status,
      reference: p.reference,
      createdAt: p.createdAt,
    })),
    paidAmount,
    balanceAmount: computeBalance(row.totalAmount, paidAmount),
  };
}

export async function listStayFormOptions(
  branchId: string,
): Promise<StayFormOptions> {
  const types = await prisma.hotelRoomType.findMany({
    where: { branchId },
    orderBy: { name: "asc" },
    include: {
      rooms: {
        orderBy: [{ floor: "asc" }, { number: "asc" }],
        select: {
          id: true,
          number: true,
          status: true,
          floor: true,
        },
      },
    },
  });

  return {
    types: types.map((t) => ({
      id: t.id,
      name: t.name,
      priceNight: t.priceNight,
      rooms: t.rooms,
    })),
  };
}
