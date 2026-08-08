import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import {
  guestDisplayName,
  type HotelStayStatusValue,
} from "@/lib/hotel/stay-status";
import prisma from "@/lib/prisma";

export type ClientStayListItem = {
  id: string;
  codeUnique: string;
  status: HotelStayStatusValue;
  guestName: string;
  roomTypeName: string;
  roomNumber: string | null;
  checkInDate: Date;
  checkOutDate: Date;
  totalAmount: number;
  paidAmount: number;
  createdAt: Date;
};

async function requireSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

/** Séjours hôtel du compte connecté pour une organisation. */
export const listMyHotelStaysForOrg = cache(
  async (organizationId: string): Promise<ClientStayListItem[] | null> => {
    const userId = await requireSessionUserId();
    if (!userId) return null;

    const rows = await prisma.hotelStay.findMany({
      where: {
        userId,
        branch: { organizationId, type: "HOTEL" },
        status: { not: "CANCELLED" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        codeUnique: true,
        status: true,
        guestPrenom: true,
        guestNom: true,
        checkInDate: true,
        checkOutDate: true,
        totalAmount: true,
        createdAt: true,
        roomType: { select: { name: true } },
        room: { select: { number: true } },
        payments: {
          where: { status: "PAYE" },
          select: { amount: true },
        },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      codeUnique: r.codeUnique,
      status: r.status as HotelStayStatusValue,
      guestName: guestDisplayName(r.guestPrenom, r.guestNom),
      roomTypeName: r.roomType.name,
      roomNumber: r.room?.number ?? null,
      checkInDate: r.checkInDate,
      checkOutDate: r.checkOutDate,
      totalAmount: r.totalAmount,
      paidAmount: r.payments.reduce((sum, p) => sum + p.amount, 0),
      createdAt: r.createdAt,
    }));
  },
);

export async function getMyHotelStayForOrg(input: {
  organizationId: string;
  stayId?: string;
  codeUnique?: string;
}) {
  const userId = await requireSessionUserId();
  if (!userId) return null;

  return prisma.hotelStay.findFirst({
    where: {
      userId,
      branch: { organizationId: input.organizationId, type: "HOTEL" },
      ...(input.stayId
        ? { id: input.stayId }
        : { codeUnique: input.codeUnique?.trim() }),
    },
    select: {
      id: true,
      codeUnique: true,
      status: true,
      guestPrenom: true,
      guestNom: true,
      guestPhone: true,
      checkInDate: true,
      checkOutDate: true,
      priceNight: true,
      totalAmount: true,
      createdAt: true,
      roomType: { select: { name: true, capacity: true } },
      room: { select: { number: true } },
      branch: { select: { name: true } },
      folioLines: {
        orderBy: { createdAt: "asc" },
        select: { id: true, label: true, amount: true, kind: true },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          method: true,
          status: true,
          reference: true,
          createdAt: true,
        },
      },
    },
  });
}
