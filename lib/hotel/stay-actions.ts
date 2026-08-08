"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { ZodError } from "zod";
import { hotelRoutes } from "@/lib/branch/paths";
import { canAccessBranch } from "@/lib/branch/user-branches";
import {
  buildNightFolioLines,
  parseDateOnlyInput,
} from "@/lib/hotel/folio-nights";
import { assertHotelStayPermission } from "@/lib/hotel/hotel-permission";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { reservationUniqueCode } from "@/lib/reservation/unique-code";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

function revalidateSejours(organizationId: string, branchId: string, stayId?: string) {
  revalidatePath(hotelRoutes.sejours(organizationId, branchId), "page");
  revalidatePath(hotelRoutes.chambres(organizationId, branchId), "page");
  revalidatePath(hotelRoutes.root(organizationId, branchId), "page");
  if (stayId) {
    revalidatePath(hotelRoutes.sejour(organizationId, branchId, stayId), "page");
  }
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

const createStaySchema = orgBranchSchema.extend({
  guestPrenom: z.string().trim().min(1, "Prénom requis.").max(80),
  guestNom: z.string().trim().min(1, "Nom requis.").max(80),
  guestPhone: z.string().trim().min(5, "Téléphone requis.").max(30),
  roomTypeId: z.string().uuid(),
  roomId: z.union([z.string().uuid(), z.literal("")]).optional(),
  checkInDate: z.string().min(1, "Date d’arrivée requise."),
  checkOutDate: z.string().min(1, "Date de départ requise."),
});

const checkInSchema = orgBranchSchema.extend({
  stayId: z.string().uuid(),
  roomId: z.union([z.string().uuid(), z.literal("")]).optional(),
});

const checkOutSchema = orgBranchSchema.extend({
  stayId: z.string().uuid(),
});

export async function createHotelStayAction(
  input: z.infer<typeof createStaySchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createStaySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const {
    organizationId,
    branchId,
    guestPrenom,
    guestNom,
    guestPhone,
    roomTypeId,
    roomId: roomIdRaw,
    checkInDate: checkInRaw,
    checkOutDate: checkOutRaw,
  } = parsed.data;

  const perm = await assertHotelStayPermission(organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const checkInDate = parseDateOnlyInput(checkInRaw);
  const checkOutDate = parseDateOnlyInput(checkOutRaw);
  if (!checkInDate || !checkOutDate) {
    return { ok: false, message: "Dates invalides." };
  }

  const roomType = await prisma.hotelRoomType.findFirst({
    where: { id: roomTypeId, branchId },
    select: { id: true, priceNight: true },
  });
  if (!roomType) {
    return { ok: false, message: "Type de chambre introuvable." };
  }

  const roomId = roomIdRaw?.trim() ? roomIdRaw.trim() : null;
  if (roomId) {
    const room = await prisma.hotelRoom.findFirst({
      where: {
        id: roomId,
        roomTypeId,
        roomType: { branchId },
      },
      select: { id: true },
    });
    if (!room) {
      return {
        ok: false,
        message: "Chambre introuvable pour ce type.",
      };
    }
  }

  const folio = buildNightFolioLines(
    checkInDate,
    checkOutDate,
    roomType.priceNight,
  );
  if (folio.nights < 1) {
    return {
      ok: false,
      message: "Le départ doit être après l’arrivée (au moins une nuit).",
    };
  }

  const created = await prisma.hotelStay.create({
    data: {
      codeUnique: reservationUniqueCode("STAY"),
      branchId,
      roomTypeId,
      roomId,
      guestPrenom,
      guestNom,
      guestPhone,
      checkInDate,
      checkOutDate,
      status: "BOOKED",
      priceNight: roomType.priceNight,
      totalAmount: folio.totalAmount,
      folioLines: {
        create: folio.lines.map((line) => ({
          label: line.label,
          amount: line.amount,
          kind: line.kind,
        })),
      },
    },
    select: { id: true },
  });

  revalidateSejours(organizationId, branchId, created.id);
  return { ok: true, data: created };
}

export async function checkInHotelStayAction(
  input: z.infer<typeof checkInSchema>,
): Promise<ActionResult> {
  const parsed = checkInSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, stayId, roomId: roomIdRaw } = parsed.data;

  const perm = await assertHotelStayPermission(organizationId, "update");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const stay = await prisma.hotelStay.findFirst({
    where: { id: stayId, branchId },
    select: {
      id: true,
      status: true,
      roomId: true,
      roomTypeId: true,
    },
  });
  if (!stay) {
    return { ok: false, message: "Séjour introuvable." };
  }
  if (stay.status !== "BOOKED") {
    return {
      ok: false,
      message: "Seuls les séjours réservés peuvent être enregistrés (check-in).",
    };
  }

  const roomId = roomIdRaw?.trim() ? roomIdRaw.trim() : stay.roomId;
  if (!roomId) {
    return {
      ok: false,
      message: "Assignez une chambre avant le check-in.",
    };
  }

  const room = await prisma.hotelRoom.findFirst({
    where: {
      id: roomId,
      roomTypeId: stay.roomTypeId,
      roomType: { branchId },
    },
    select: { id: true, status: true },
  });
  if (!room) {
    return { ok: false, message: "Chambre introuvable pour ce type." };
  }
  if (room.status !== "AVAILABLE") {
    return {
      ok: false,
      message:
        "Check-in possible uniquement si la chambre est Libre · Prête. Corrigez le statut d’abord.",
    };
  }

  await prisma.$transaction([
    prisma.hotelStay.update({
      where: { id: stay.id },
      data: {
        roomId: room.id,
        status: "IN_HOUSE",
      },
    }),
    prisma.hotelRoom.update({
      where: { id: room.id },
      data: { status: "OCCUPIED" },
    }),
  ]);

  revalidateSejours(organizationId, branchId, stay.id);
  return { ok: true, data: undefined };
}

export async function checkOutHotelStayAction(
  input: z.infer<typeof checkOutSchema>,
): Promise<ActionResult> {
  const parsed = checkOutSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, stayId } = parsed.data;

  const perm = await assertHotelStayPermission(organizationId, "update");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const stay = await prisma.hotelStay.findFirst({
    where: { id: stayId, branchId },
    select: {
      id: true,
      status: true,
      roomId: true,
    },
  });
  if (!stay) {
    return { ok: false, message: "Séjour introuvable." };
  }
  if (stay.status !== "IN_HOUSE") {
    return {
      ok: false,
      message: "Seuls les séjours en maison peuvent faire un check-out.",
    };
  }
  if (!stay.roomId) {
    return { ok: false, message: "Aucune chambre assignée à ce séjour." };
  }

  await prisma.$transaction([
    prisma.hotelStay.update({
      where: { id: stay.id },
      data: { status: "CHECKED_OUT" },
    }),
    prisma.hotelRoom.update({
      where: { id: stay.roomId },
      data: { status: "CLEANING" },
    }),
  ]);

  revalidateSejours(organizationId, branchId, stay.id);
  return { ok: true, data: undefined };
}
