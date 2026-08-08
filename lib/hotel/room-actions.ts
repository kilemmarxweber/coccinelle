"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { ZodError } from "zod";
import { hotelRoutes } from "@/lib/branch/paths";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { assertHotelRoomPermission } from "@/lib/hotel/hotel-permission";
import {
  HOTEL_ROOM_STATUSES,
  isHotelRoomStatus,
} from "@/lib/hotel/room-status";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

function revalidateChambres(organizationId: string, branchId: string) {
  revalidatePath(hotelRoutes.chambres(organizationId, branchId), "page");
  revalidatePath(hotelRoutes.root(organizationId, branchId), "page");
}

async function assertHotelBranchAccess(
  organizationId: string,
  branchId: string,
): Promise<ActionResult<{ branchId: string }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { ok: false, message: "Non authentifié." };
  }
  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    branchId,
  );
  if (!branch || branch.organizationId !== organizationId) {
    return { ok: false, message: "Branche introuvable." };
  }
  if (branch.type !== "HOTEL") {
    return { ok: false, message: "Cette branche n’est pas un hôtel." };
  }
  return { ok: true, data: { branchId: branch.id } };
}

const orgBranchSchema = z.object({
  organizationId: z.string().min(1),
  branchId: z.string().uuid(),
});

const updateStatusSchema = orgBranchSchema.extend({
  roomId: z.string().uuid(),
  status: z.enum(HOTEL_ROOM_STATUSES),
});

const roomTypeFieldsSchema = z.object({
  name: z.string().trim().min(1, "Nom requis.").max(80),
  description: z.string().trim().max(500).optional(),
  capacity: z.coerce.number().int().min(1).max(20),
  priceNight: z.coerce.number().min(0),
});

const createTypeSchema = orgBranchSchema.merge(roomTypeFieldsSchema);

const updateTypeSchema = orgBranchSchema.merge(roomTypeFieldsSchema).extend({
  roomTypeId: z.string().uuid(),
});

const roomFieldsSchema = z.object({
  roomTypeId: z.string().uuid(),
  number: z.string().trim().min(1, "Numéro requis.").max(20),
  floor: z.string().trim().max(20).optional(),
});

const createRoomSchema = orgBranchSchema.merge(roomFieldsSchema);

const updateRoomSchema = orgBranchSchema.merge(roomFieldsSchema).extend({
  roomId: z.string().uuid(),
});

export async function updateHotelRoomStatusAction(
  input: z.infer<typeof updateStatusSchema>,
): Promise<ActionResult> {
  const parsed = updateStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, roomId, status } = parsed.data;

  const perm = await assertHotelRoomPermission(organizationId, "update");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const room = await prisma.hotelRoom.findFirst({
    where: {
      id: roomId,
      roomType: { branchId },
    },
    select: { id: true },
  });
  if (!room) {
    return { ok: false, message: "Chambre introuvable." };
  }
  if (!isHotelRoomStatus(status)) {
    return { ok: false, message: "Statut invalide." };
  }

  await prisma.hotelRoom.update({
    where: { id: roomId },
    data: { status },
  });

  revalidateChambres(organizationId, branchId);
  return { ok: true, data: undefined };
}

export async function createHotelRoomTypeAction(
  input: z.infer<typeof createTypeSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, name, description, capacity, priceNight } =
    parsed.data;

  const perm = await assertHotelRoomPermission(organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const created = await prisma.hotelRoomType.create({
    data: {
      branchId,
      name,
      description: description || null,
      capacity,
      priceNight,
    },
    select: { id: true },
  });

  revalidateChambres(organizationId, branchId);
  return { ok: true, data: created };
}

export async function updateHotelRoomTypeAction(
  input: z.infer<typeof updateTypeSchema>,
): Promise<ActionResult> {
  const parsed = updateTypeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const {
    organizationId,
    branchId,
    roomTypeId,
    name,
    description,
    capacity,
    priceNight,
  } = parsed.data;

  const perm = await assertHotelRoomPermission(organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const existing = await prisma.hotelRoomType.findFirst({
    where: { id: roomTypeId, branchId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, message: "Type de chambre introuvable." };
  }

  await prisma.hotelRoomType.update({
    where: { id: roomTypeId },
    data: {
      name,
      description: description || null,
      capacity,
      priceNight,
    },
  });

  revalidateChambres(organizationId, branchId);
  return { ok: true, data: undefined };
}

export async function createHotelRoomAction(
  input: z.infer<typeof createRoomSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createRoomSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, roomTypeId, number, floor } = parsed.data;

  const perm = await assertHotelRoomPermission(organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const roomType = await prisma.hotelRoomType.findFirst({
    where: { id: roomTypeId, branchId },
    select: { id: true },
  });
  if (!roomType) {
    return { ok: false, message: "Type de chambre introuvable." };
  }

  try {
    const created = await prisma.hotelRoom.create({
      data: {
        roomTypeId,
        number,
        floor: floor?.trim() ? floor.trim() : null,
        status: "AVAILABLE",
      },
      select: { id: true },
    });
    revalidateChambres(organizationId, branchId);
    return { ok: true, data: created };
  } catch {
    return {
      ok: false,
      message: "Impossible de créer la chambre (numéro déjà utilisé ?).",
    };
  }
}

export async function updateHotelRoomAction(
  input: z.infer<typeof updateRoomSchema>,
): Promise<ActionResult> {
  const parsed = updateRoomSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, roomId, roomTypeId, number, floor } =
    parsed.data;

  const perm = await assertHotelRoomPermission(organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const room = await prisma.hotelRoom.findFirst({
    where: {
      id: roomId,
      roomType: { branchId },
    },
    select: { id: true },
  });
  if (!room) {
    return { ok: false, message: "Chambre introuvable." };
  }

  const roomType = await prisma.hotelRoomType.findFirst({
    where: { id: roomTypeId, branchId },
    select: { id: true },
  });
  if (!roomType) {
    return { ok: false, message: "Type de chambre introuvable." };
  }

  try {
    await prisma.hotelRoom.update({
      where: { id: roomId },
      data: {
        roomTypeId,
        number,
        floor: floor?.trim() ? floor.trim() : null,
      },
    });
    revalidateChambres(organizationId, branchId);
    return { ok: true, data: undefined };
  } catch {
    return {
      ok: false,
      message: "Impossible de modifier la chambre (numéro déjà utilisé ?).",
    };
  }
}
