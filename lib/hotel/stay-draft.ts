import { Prisma } from "@/prisma/generated/prisma/client";
import {
  assertRoomTypeAvailable,
  parseBookingDateRange,
} from "@/lib/hotel/availability";
import {
  hotelStayDraftPayloadSchema,
  type HotelStayDraftPayload,
} from "@/lib/hotel/stay-draft-schema";
import prisma from "@/lib/prisma";

export const HOTEL_DRAFT_TTL_MINUTES = 30;

export class HotelDraftExpiredError extends Error {
  constructor(message = "Ce brouillon de réservation a expiré.") {
    super(message);
    this.name = "HotelDraftExpiredError";
  }
}

export class HotelDraftNotFoundError extends Error {
  constructor(message = "Brouillon introuvable.") {
    super(message);
    this.name = "HotelDraftNotFoundError";
  }
}

export function hotelDraftExpiresAt(from: Date = new Date()): Date {
  return new Date(from.getTime() + HOTEL_DRAFT_TTL_MINUTES * 60_000);
}

export function isHotelDraftExpired(
  expiresAt: Date,
  now: Date = new Date(),
): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function parseHotelStayDraftPayload(raw: unknown): HotelStayDraftPayload {
  return hotelStayDraftPayloadSchema.parse(raw);
}

export type HotelStayDraftView = {
  id: string;
  draftToken: string;
  organizationId: string;
  branchId: string;
  expiresAt: Date;
  expired: boolean;
  payload: HotelStayDraftPayload;
};

export async function createHotelStayDraft(input: {
  organizationId: string;
  branchId: string;
  roomTypeId: string;
  checkInRaw: string;
  checkOutRaw: string;
  userId?: string | null;
}): Promise<{ draftToken: string }> {
  const range = parseBookingDateRange(input.checkInRaw, input.checkOutRaw);
  if (!range.ok) {
    throw new HotelDraftNotFoundError(range.error);
  }

  const roomType = await prisma.hotelRoomType.findFirst({
    where: { id: input.roomTypeId, branchId: input.branchId },
    select: { id: true, name: true, priceNight: true },
  });
  if (!roomType) {
    throw new HotelDraftNotFoundError("Type de chambre introuvable.");
  }

  const avail = await assertRoomTypeAvailable({
    branchId: input.branchId,
    roomTypeId: roomType.id,
    checkInDate: range.checkInDate,
    checkOutDate: range.checkOutDate,
  });
  if (!avail.ok) {
    throw new HotelDraftNotFoundError(avail.error);
  }

  const payload = hotelStayDraftPayloadSchema.parse({
    step: "guest",
    roomTypeId: roomType.id,
    roomTypeName: roomType.name,
    checkInDate: input.checkInRaw,
    checkOutDate: input.checkOutRaw,
    nights: range.nights,
    priceNight: roomType.priceNight,
    totalAmount: range.nights * roomType.priceNight,
    guestPrenom: "",
    guestNom: "",
    guestPhone: "",
  });

  const draft = await prisma.hotelStayDraft.create({
    data: {
      organizationId: input.organizationId,
      branchId: input.branchId,
      userId: input.userId ?? null,
      expiresAt: hotelDraftExpiresAt(),
      payload: payload as Prisma.InputJsonValue,
    },
    select: { draftToken: true },
  });

  return { draftToken: draft.draftToken };
}

export async function getHotelStayDraft(input: {
  organizationId: string;
  draftToken: string;
}): Promise<HotelStayDraftView | null> {
  const draft = await prisma.hotelStayDraft.findFirst({
    where: {
      draftToken: input.draftToken.trim(),
      organizationId: input.organizationId,
    },
  });
  if (!draft) return null;

  return {
    id: draft.id,
    draftToken: draft.draftToken,
    organizationId: draft.organizationId,
    branchId: draft.branchId,
    expiresAt: draft.expiresAt,
    expired: isHotelDraftExpired(draft.expiresAt),
    payload: parseHotelStayDraftPayload(draft.payload),
  };
}

export async function updateHotelStayDraft(input: {
  organizationId: string;
  draftToken: string;
  payload: HotelStayDraftPayload;
}): Promise<HotelStayDraftView> {
  const draft = await getHotelStayDraft({
    organizationId: input.organizationId,
    draftToken: input.draftToken,
  });
  if (!draft) throw new HotelDraftNotFoundError();
  if (draft.expired) throw new HotelDraftExpiredError();

  const payload = hotelStayDraftPayloadSchema.parse(input.payload);

  const updated = await prisma.hotelStayDraft.update({
    where: { id: draft.id },
    data: {
      payload: payload as Prisma.InputJsonValue,
      expiresAt: hotelDraftExpiresAt(),
    },
  });

  return {
    id: updated.id,
    draftToken: updated.draftToken,
    organizationId: updated.organizationId,
    branchId: updated.branchId,
    expiresAt: updated.expiresAt,
    expired: false,
    payload,
  };
}

export async function bindHotelStayDraftUser(input: {
  organizationId: string;
  draftToken: string;
  userId: string;
}): Promise<void> {
  const draft = await prisma.hotelStayDraft.findFirst({
    where: {
      draftToken: input.draftToken.trim(),
      organizationId: input.organizationId,
    },
    select: { id: true, expiresAt: true },
  });
  if (!draft) throw new HotelDraftNotFoundError();
  if (isHotelDraftExpired(draft.expiresAt)) throw new HotelDraftExpiredError();

  await prisma.hotelStayDraft.update({
    where: { id: draft.id },
    data: { userId: input.userId },
  });
}

export async function consumeHotelStayDraft(input: {
  organizationId: string;
  draftToken: string;
}): Promise<void> {
  await prisma.hotelStayDraft.deleteMany({
    where: {
      draftToken: input.draftToken.trim(),
      organizationId: input.organizationId,
    },
  });
}
