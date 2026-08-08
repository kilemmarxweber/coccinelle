import { cache } from "react";
import { cookies } from "next/headers";
import { guestDisplayName } from "@/lib/hotel/stay-status";
import {
  listMenuCategories,
  type MenuCategoryView,
} from "@/lib/hotel/list-fnb";
import type { HotelFoodOrderStatusValue } from "@/lib/hotel/food-order-status";
import prisma from "@/lib/prisma";

export type PublicHotelBranch = {
  id: string;
  organizationId: string;
  name: string;
  code: string;
};

export type GuestStayLink = {
  id: string;
  branchId: string;
  guestName: string;
  guestPhone: string;
  roomNumber: string | null;
};

export type GuestFoodOrderView = {
  id: string;
  status: HotelFoodOrderStatusValue;
  notes: string | null;
  createdAt: Date;
  stayGuestName: string | null;
  stayRoomNumber: string | null;
  lines: Array<{
    id: string;
    name: string;
    unitPrice: number;
    quantity: number;
  }>;
  totalAmount: number;
};

export type HotelRoomServiceClaim = {
  organizationId: string;
  stayId: string;
  guestPhone: string;
  roomNumber: string;
};

export const HOTEL_RS_CLAIM_COOKIE = "hotel_rs_claim";

/** Digits-only phone for stay claim matching. */
export function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export async function readHotelRoomServiceClaim(): Promise<HotelRoomServiceClaim | null> {
  const jar = await cookies();
  const raw = jar.get(HOTEL_RS_CLAIM_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as HotelRoomServiceClaim;
    if (
      !parsed?.organizationId ||
      !parsed?.stayId ||
      !parsed?.guestPhone ||
      !parsed?.roomNumber
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export const getPublicHotelBranchForOrg = cache(
  async (organizationId: string): Promise<PublicHotelBranch | null> => {
    const branch = await prisma.branch.findFirst({
      where: {
        organizationId,
        type: "HOTEL",
        status: "ACTIVE",
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        organizationId: true,
        name: true,
        code: true,
      },
    });
    return branch;
  },
);

export async function listActiveMenuForBranch(
  branchId: string,
): Promise<MenuCategoryView[]> {
  const categories = await listMenuCategories(branchId);
  return categories
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) => item.active),
    }))
    .filter((cat) => cat.items.length > 0);
}

/**
 * Links an authenticated guest to an IN_HOUSE stay via phone + room number.
 * Walk-ins from units-02 have no userId on stay — claim is intentional.
 */
export async function findInHouseStayByClaim(input: {
  branchId: string;
  guestPhone: string;
  roomNumber: string;
}): Promise<GuestStayLink | null> {
  const phoneDigits = normalizePhoneDigits(input.guestPhone);
  const room = input.roomNumber.trim();
  if (!phoneDigits || !room) return null;

  const stays = await prisma.hotelStay.findMany({
    where: {
      branchId: input.branchId,
      status: "IN_HOUSE",
      room: { number: room },
    },
    select: {
      id: true,
      branchId: true,
      guestPrenom: true,
      guestNom: true,
      guestPhone: true,
      room: { select: { number: true } },
    },
  });

  const match = stays.find(
    (stay) => normalizePhoneDigits(stay.guestPhone) === phoneDigits,
  );
  if (!match) return null;

  return {
    id: match.id,
    branchId: match.branchId,
    guestName: guestDisplayName(match.guestPrenom, match.guestNom),
    guestPhone: match.guestPhone,
    roomNumber: match.room?.number ?? null,
  };
}

export async function getGuestFoodOrderForOrg(input: {
  organizationId: string;
  orderId: string;
  guestPhone: string;
}): Promise<GuestFoodOrderView | null> {
  const phoneDigits = normalizePhoneDigits(input.guestPhone);
  if (!phoneDigits) return null;

  const order = await prisma.hotelFoodOrder.findFirst({
    where: {
      id: input.orderId,
      source: "CLIENT_ONLINE",
      branch: {
        organizationId: input.organizationId,
        type: "HOTEL",
      },
    },
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      stay: {
        select: {
          guestPrenom: true,
          guestNom: true,
          guestPhone: true,
          room: { select: { number: true } },
        },
      },
    },
  });

  if (!order?.stay) return null;
  if (normalizePhoneDigits(order.stay.guestPhone) !== phoneDigits) {
    return null;
  }

  const lines = order.lines.map((line) => ({
    id: line.id,
    name: line.name,
    unitPrice: line.unitPrice,
    quantity: line.quantity,
  }));
  const totalAmount = lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );

  return {
    id: order.id,
    status: order.status as HotelFoodOrderStatusValue,
    notes: order.notes,
    createdAt: order.createdAt,
    stayGuestName: guestDisplayName(
      order.stay.guestPrenom,
      order.stay.guestNom,
    ),
    stayRoomNumber: order.stay.room?.number ?? null,
    lines,
    totalAmount,
  };
}
