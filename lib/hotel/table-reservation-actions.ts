"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { ZodError } from "zod";
import { auth } from "@/lib/auth";
import { hotelRoutes, clientHotelRoutes } from "@/lib/branch/paths";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { assertHotelFnbPermission } from "@/lib/hotel/hotel-permission";
import {
  listAvailableTablesForSlot,
  pickAutoAssignTable,
} from "@/lib/hotel/table-availability";
import { getPublicHotelBranchForOrg } from "@/lib/hotel/client-online-order";
import prisma from "@/lib/prisma";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

function revalidateTableSurfaces(
  organizationId: string,
  branchId: string,
  orgSlug?: string,
) {
  revalidatePath(hotelRoutes.restauration(organizationId, branchId), "page");
  revalidatePath(hotelRoutes.root(organizationId, branchId), "page");
  if (orgSlug) {
    revalidatePath(clientHotelRoutes.table(orgSlug), "page");
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

const orderLineSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
});

const guestFieldsSchema = z.object({
  guestPrenom: z.string().trim().min(1, "Prénom requis.").max(80),
  guestNom: z.string().trim().min(1, "Nom requis.").max(80),
  guestPhone: z.string().trim().min(5, "Téléphone requis.").max(30),
});

const slotSchema = z.object({
  startsAt: z.coerce.date(),
  covers: z.coerce.number().int().min(1, "Au moins 1 couvert.").max(50),
  tableId: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  notes: z.string().trim().max(500).optional(),
  lines: z.array(orderLineSchema).optional(),
});

function assertStartsAtFuture(startsAt: Date): string | null {
  const min = Date.now() - 60_000;
  if (startsAt.getTime() < min) {
    return "Choisissez une date et heure à venir.";
  }
  return null;
}

async function resolveClientId(userId: string | undefined): Promise<string | null> {
  if (!userId) return null;
  const client = await prisma.client.findUnique({
    where: { userId },
    select: { id: true },
  });
  return client?.id ?? null;
}

async function buildFoodLines(
  branchId: string,
  lines: Array<{ menuItemId: string; quantity: number }> | undefined,
): Promise<
  | { ok: true; data: Array<{ menuItemId: string; name: string; unitPrice: number; quantity: number }> }
  | { ok: false; message: string }
> {
  if (!lines || lines.length === 0) {
    return { ok: true, data: [] };
  }
  const menuItemIds = [...new Set(lines.map((l) => l.menuItemId))];
  const menuItems = await prisma.hotelMenuItem.findMany({
    where: {
      id: { in: menuItemIds },
      active: true,
      category: { branchId },
    },
    select: { id: true, name: true, price: true },
  });
  if (menuItems.length !== menuItemIds.length) {
    return { ok: false, message: "Un ou plusieurs plats sont invalides." };
  }
  const itemById = new Map(menuItems.map((item) => [item.id, item]));
  return {
    ok: true,
    data: lines.map((line) => {
      const item = itemById.get(line.menuItemId)!;
      return {
        menuItemId: item.id,
        name: item.name,
        unitPrice: item.price,
        quantity: line.quantity,
      };
    }),
  };
}

async function assignTable(params: {
  branchId: string;
  startsAt: Date;
  covers: number;
  tableId?: string | null;
}): Promise<ActionResult<{ tableId: string }>> {
  const requested = params.tableId?.trim() ? params.tableId.trim() : null;
  if (requested) {
    const available = await listAvailableTablesForSlot({
      branchId: params.branchId,
      startsAt: params.startsAt,
      covers: params.covers,
    });
    if (!available.some((t) => t.id === requested)) {
      return {
        ok: false,
        message: "Cette table n’est pas disponible pour ce créneau.",
      };
    }
    return { ok: true, data: { tableId: requested } };
  }

  const auto = await pickAutoAssignTable({
    branchId: params.branchId,
    startsAt: params.startsAt,
    covers: params.covers,
  });
  if (!auto) {
    return {
      ok: false,
      message: "Aucune table disponible pour ce créneau et ce nombre de couverts.",
    };
  }
  return { ok: true, data: { tableId: auto.id } };
}

const createClientSchema = guestFieldsSchema.merge(slotSchema).extend({
  organizationId: z.string().min(1),
});

/** Client en ligne : réserve une table seule ou avec plats. */
export async function createClientTableReservationAction(
  input: z.infer<typeof createClientSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createClientSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const futureErr = assertStartsAtFuture(parsed.data.startsAt);
  if (futureErr) return { ok: false, message: futureErr };

  const branch = await getPublicHotelBranchForOrg(parsed.data.organizationId);
  if (!branch) {
    return {
      ok: false,
      message: "Aucun hôtel disponible pour cette organisation.",
    };
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const clientId = await resolveClientId(session?.user?.id);

  const tableResult = await assignTable({
    branchId: branch.id,
    startsAt: parsed.data.startsAt,
    covers: parsed.data.covers,
    tableId: parsed.data.tableId,
  });
  if (!tableResult.ok) return tableResult;

  const linesResult = await buildFoodLines(branch.id, parsed.data.lines);
  if (!linesResult.ok) return linesResult;

  const timeLabel = parsed.data.startsAt.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });
  const foodNote = `Précommande table — ${timeLabel}`;

  const created = await prisma.$transaction(async (tx) => {
    const reservation = await tx.hotelTableReservation.create({
      data: {
        branchId: branch.id,
        tableId: tableResult.data.tableId,
        guestPrenom: parsed.data.guestPrenom,
        guestNom: parsed.data.guestNom,
        guestPhone: parsed.data.guestPhone,
        startsAt: parsed.data.startsAt,
        covers: parsed.data.covers,
        status: "CONFIRMED",
        clientId,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
      },
      select: { id: true },
    });

    if (linesResult.data.length > 0) {
      await tx.hotelFoodOrder.create({
        data: {
          branchId: branch.id,
          tableId: tableResult.data.tableId,
          tableReservationId: reservation.id,
          source: "CLIENT_ONLINE",
          status: "NEW",
          notes: foodNote,
          lines: { create: linesResult.data },
        },
      });
    }

    return reservation;
  });

  const org = await prisma.organization.findUnique({
    where: { id: parsed.data.organizationId },
    select: { slug: true },
  });
  revalidateTableSurfaces(
    parsed.data.organizationId,
    branch.id,
    org?.slug ?? undefined,
  );
  revalidatePath(hotelRoutes.restauration(parsed.data.organizationId, branch.id), "page");

  return { ok: true, data: created };
}

const createAdminSchema = guestFieldsSchema.merge(slotSchema).extend({
  organizationId: z.string().min(1),
  branchId: z.string().uuid(),
  stayId: z.union([z.string().uuid(), z.literal("")]).optional(),
});

/** Admin (téléphone / walk-in réservation) : crée une réservation de table. */
export async function createAdminTableReservationAction(
  input: z.infer<typeof createAdminSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createAdminSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const access = await assertHotelBranchAccess(
    parsed.data.organizationId,
    parsed.data.branchId,
  );
  if (!access.ok) return access;

  const perm = await assertHotelFnbPermission(
    parsed.data.organizationId,
    "create",
  );
  if (!perm.ok) return perm;

  const futureErr = assertStartsAtFuture(parsed.data.startsAt);
  if (futureErr) return { ok: false, message: futureErr };

  let stayId: string | null = null;
  if (parsed.data.stayId && parsed.data.stayId !== "") {
    const stay = await prisma.hotelStay.findFirst({
      where: {
        id: parsed.data.stayId,
        branchId: parsed.data.branchId,
        status: { in: ["BOOKED", "IN_HOUSE"] },
      },
      select: { id: true },
    });
    if (!stay) {
      return { ok: false, message: "Séjour introuvable." };
    }
    stayId = stay.id;
  }

  const tableResult = await assignTable({
    branchId: parsed.data.branchId,
    startsAt: parsed.data.startsAt,
    covers: parsed.data.covers,
    tableId: parsed.data.tableId,
  });
  if (!tableResult.ok) return tableResult;

  const linesResult = await buildFoodLines(
    parsed.data.branchId,
    parsed.data.lines,
  );
  if (!linesResult.ok) return linesResult;

  const timeLabel = parsed.data.startsAt.toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  const created = await prisma.$transaction(async (tx) => {
    const reservation = await tx.hotelTableReservation.create({
      data: {
        branchId: parsed.data.branchId,
        tableId: tableResult.data.tableId,
        guestPrenom: parsed.data.guestPrenom,
        guestNom: parsed.data.guestNom,
        guestPhone: parsed.data.guestPhone,
        startsAt: parsed.data.startsAt,
        covers: parsed.data.covers,
        status: "CONFIRMED",
        stayId,
        notes: parsed.data.notes?.trim() ? parsed.data.notes.trim() : null,
      },
      select: { id: true },
    });

    if (linesResult.data.length > 0) {
      await tx.hotelFoodOrder.create({
        data: {
          branchId: parsed.data.branchId,
          tableId: tableResult.data.tableId,
          tableReservationId: reservation.id,
          stayId,
          source: "STAFF_SUR_PLACE",
          status: "NEW",
          notes: `Précommande table — ${timeLabel}`,
          lines: { create: linesResult.data },
        },
      });
    }

    return reservation;
  });

  revalidateTableSurfaces(parsed.data.organizationId, parsed.data.branchId);
  return { ok: true, data: created };
}

const cancelSchema = z.object({
  organizationId: z.string().min(1),
  branchId: z.string().uuid(),
  reservationId: z.string().uuid(),
});

export async function cancelAdminTableReservationAction(
  input: z.infer<typeof cancelSchema>,
): Promise<ActionResult> {
  const parsed = cancelSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const access = await assertHotelBranchAccess(
    parsed.data.organizationId,
    parsed.data.branchId,
  );
  if (!access.ok) return access;

  const perm = await assertHotelFnbPermission(
    parsed.data.organizationId,
    "update",
  );
  if (!perm.ok) return perm;

  const existing = await prisma.hotelTableReservation.findFirst({
    where: {
      id: parsed.data.reservationId,
      branchId: parsed.data.branchId,
    },
    select: { id: true, status: true },
  });
  if (!existing) {
    return { ok: false, message: "Réservation introuvable." };
  }
  if (existing.status !== "CONFIRMED") {
    return { ok: false, message: "Cette réservation ne peut plus être annulée." };
  }

  await prisma.hotelTableReservation.update({
    where: { id: existing.id },
    data: { status: "CANCELLED" },
  });

  revalidateTableSurfaces(parsed.data.organizationId, parsed.data.branchId);
  return { ok: true, data: undefined };
}

const availabilityQuerySchema = z.object({
  organizationId: z.string().min(1),
  startsAt: z.coerce.date(),
  covers: z.coerce.number().int().min(1).max(50),
});

/** Client : tables disponibles pour un créneau. */
export async function getClientAvailableTablesAction(
  input: z.infer<typeof availabilityQuerySchema>,
): Promise<
  ActionResult<Array<{ id: string; number: string; capacity: number }>>
> {
  const parsed = availabilityQuerySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const futureErr = assertStartsAtFuture(parsed.data.startsAt);
  if (futureErr) return { ok: false, message: futureErr };

  const branch = await getPublicHotelBranchForOrg(parsed.data.organizationId);
  if (!branch) {
    return {
      ok: false,
      message: "Aucun hôtel disponible pour cette organisation.",
    };
  }

  const tables = await listAvailableTablesForSlot({
    branchId: branch.id,
    startsAt: parsed.data.startsAt,
    covers: parsed.data.covers,
  });
  return { ok: true, data: tables };
}

const adminAvailabilitySchema = availabilityQuerySchema.extend({
  branchId: z.string().uuid(),
});

export async function getAdminAvailableTablesAction(
  input: z.infer<typeof adminAvailabilitySchema>,
): Promise<
  ActionResult<Array<{ id: string; number: string; capacity: number }>>
> {
  const parsed = adminAvailabilitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }

  const access = await assertHotelBranchAccess(
    parsed.data.organizationId,
    parsed.data.branchId,
  );
  if (!access.ok) return access;

  const tables = await listAvailableTablesForSlot({
    branchId: parsed.data.branchId,
    startsAt: parsed.data.startsAt,
    covers: parsed.data.covers,
  });
  return { ok: true, data: tables };
}
