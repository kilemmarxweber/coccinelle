"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import type { ZodError } from "zod";
import { hotelRoutes } from "@/lib/branch/paths";
import {
  findInHouseStayByClaim,
  getPublicHotelBranchForOrg,
  HOTEL_RS_CLAIM_COOKIE,
  normalizePhoneDigits,
  type GuestStayLink,
  type HotelRoomServiceClaim,
} from "@/lib/hotel/client-online-order";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

const CLAIM_MAX_AGE_SEC = 60 * 60 * 24;

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

async function requireAuthUserId(): Promise<ActionResult<{ userId: string }>> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user?.id) {
    return { ok: false, message: "Connectez-vous pour commander." };
  }
  return { ok: true, data: { userId: session.user.id } };
}

async function writeClaimCookie(claim: HotelRoomServiceClaim): Promise<void> {
  const jar = await cookies();
  jar.set(HOTEL_RS_CLAIM_COOKIE, JSON.stringify(claim), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: CLAIM_MAX_AGE_SEC,
  });
}

const claimStaySchema = z.object({
  organizationId: z.string().min(1),
  guestPhone: z.string().trim().min(5, "Téléphone requis.").max(30),
  roomNumber: z.string().trim().min(1, "Numéro de chambre requis.").max(20),
});

const orderLineSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
});

const createOnlineOrderSchema = z.object({
  organizationId: z.string().min(1),
  stayId: z.string().uuid(),
  guestPhone: z.string().trim().min(5, "Téléphone requis.").max(30),
  roomNumber: z.string().trim().min(1, "Numéro de chambre requis.").max(20),
  notes: z.string().trim().max(500).optional(),
  lines: z.array(orderLineSchema).min(1, "Ajoutez au moins un plat."),
});

export async function claimGuestStayAction(
  input: z.infer<typeof claimStaySchema>,
): Promise<ActionResult<GuestStayLink>> {
  const parsed = claimStaySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const authResult = await requireAuthUserId();
  if (!authResult.ok) return authResult;

  const branch = await getPublicHotelBranchForOrg(parsed.data.organizationId);
  if (!branch) {
    return {
      ok: false,
      message: "Aucun hôtel disponible pour cette organisation.",
    };
  }

  const stay = await findInHouseStayByClaim({
    branchId: branch.id,
    guestPhone: parsed.data.guestPhone,
    roomNumber: parsed.data.roomNumber,
  });
  if (!stay) {
    return {
      ok: false,
      message:
        "Aucun séjour en maison trouvé pour ce téléphone et cette chambre.",
    };
  }

  await writeClaimCookie({
    organizationId: parsed.data.organizationId,
    stayId: stay.id,
    guestPhone: parsed.data.guestPhone.trim(),
    roomNumber: parsed.data.roomNumber.trim(),
  });

  return { ok: true, data: stay };
}

export async function createOnlineFoodOrderAction(
  input: z.infer<typeof createOnlineOrderSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createOnlineOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const authResult = await requireAuthUserId();
  if (!authResult.ok) return authResult;

  const {
    organizationId,
    stayId,
    guestPhone,
    roomNumber,
    notes,
    lines,
  } = parsed.data;

  const branch = await getPublicHotelBranchForOrg(organizationId);
  if (!branch) {
    return {
      ok: false,
      message: "Aucun hôtel disponible pour cette organisation.",
    };
  }

  const claimed = await findInHouseStayByClaim({
    branchId: branch.id,
    guestPhone,
    roomNumber,
  });
  if (!claimed || claimed.id !== stayId) {
    return {
      ok: false,
      message: "Séjour invalide. Vérifiez le téléphone et la chambre.",
    };
  }

  const stay = await prisma.hotelStay.findFirst({
    where: {
      id: stayId,
      branchId: branch.id,
      status: "IN_HOUSE",
    },
    select: { id: true, guestPhone: true },
  });
  if (!stay) {
    return { ok: false, message: "Séjour en maison introuvable." };
  }
  if (
    normalizePhoneDigits(stay.guestPhone) !== normalizePhoneDigits(guestPhone)
  ) {
    return { ok: false, message: "Téléphone ne correspond pas au séjour." };
  }

  const menuItemIds = [...new Set(lines.map((l) => l.menuItemId))];
  const menuItems = await prisma.hotelMenuItem.findMany({
    where: {
      id: { in: menuItemIds },
      active: true,
      category: { branchId: branch.id },
    },
    select: { id: true, name: true, price: true },
  });
  if (menuItems.length !== menuItemIds.length) {
    return { ok: false, message: "Un ou plusieurs plats sont invalides." };
  }

  const itemById = new Map(menuItems.map((item) => [item.id, item]));
  const lineData = lines.map((line) => {
    const item = itemById.get(line.menuItemId)!;
    return {
      menuItemId: item.id,
      name: item.name,
      unitPrice: item.price,
      quantity: line.quantity,
    };
  });
  const totalAmount = lineData.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );

  const created = await prisma.$transaction(async (tx) => {
    const order = await tx.hotelFoodOrder.create({
      data: {
        branchId: branch.id,
        stayId: stay.id,
        source: "CLIENT_ONLINE",
        status: "NEW",
        notes: notes?.trim() ? notes.trim() : null,
        lines: { create: lineData },
      },
      select: { id: true },
    });

    if (totalAmount > 0) {
      const label =
        lineData.length === 1
          ? `Room service — ${lineData[0].name}`
          : `Room service — ${lineData.length} articles`;
      await tx.hotelFolioLine.create({
        data: {
          stayId: stay.id,
          label,
          amount: totalAmount,
          kind: "OTHER",
        },
      });
      await tx.hotelStay.update({
        where: { id: stay.id },
        data: { totalAmount: { increment: totalAmount } },
      });
    }

    return order;
  });

  await writeClaimCookie({
    organizationId,
    stayId: stay.id,
    guestPhone: guestPhone.trim(),
    roomNumber: roomNumber.trim(),
  });

  revalidatePath(hotelRoutes.restauration(organizationId, branch.id), "page");
  revalidatePath(
    hotelRoutes.sejour(organizationId, branch.id, stay.id),
    "page",
  );
  revalidatePath(hotelRoutes.sejours(organizationId, branch.id), "page");

  return { ok: true, data: created };
}
