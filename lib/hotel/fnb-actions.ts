"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import type { ZodError } from "zod";
import { hotelRoutes } from "@/lib/branch/paths";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { assertHotelFnbPermission } from "@/lib/hotel/hotel-permission";
import {
  nextFoodOrderStatus,
  type HotelFoodOrderStatusValue,
} from "@/lib/hotel/food-order-status";
import {
  HOTEL_RESTAURANT_TABLE_STATUSES,
} from "@/lib/hotel/table-status";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; message: string };

function zodFirstMessage(err: ZodError): string {
  return err.issues[0]?.message ?? "Données invalides.";
}

function revalidateRestauration(organizationId: string, branchId: string) {
  revalidatePath(hotelRoutes.restauration(organizationId, branchId), "page");
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

const createCategorySchema = orgBranchSchema.extend({
  name: z.string().trim().min(1, "Nom requis.").max(80),
});

const updateCategorySchema = createCategorySchema.extend({
  categoryId: z.string().uuid(),
});

const deleteCategorySchema = orgBranchSchema.extend({
  categoryId: z.string().uuid(),
});

const createItemSchema = orgBranchSchema.extend({
  categoryId: z.string().uuid(),
  name: z.string().trim().min(1, "Nom requis.").max(120),
  description: z.string().trim().max(500).optional(),
  price: z.coerce.number().min(0, "Prix invalide."),
});

const updateItemSchema = createItemSchema.extend({
  itemId: z.string().uuid(),
  active: z.boolean().optional(),
});

const deleteItemSchema = orgBranchSchema.extend({
  itemId: z.string().uuid(),
});

const orderLineSchema = z.object({
  menuItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(99),
});

const createOrderSchema = orgBranchSchema.extend({
  stayId: z.union([z.string().uuid(), z.literal("")]).optional(),
  tableId: z.union([z.string().uuid(), z.literal("")]).optional(),
  notes: z.string().trim().max(500).optional(),
  lines: z.array(orderLineSchema).min(1, "Ajoutez au moins un plat."),
});

const advanceOrderSchema = orgBranchSchema.extend({
  orderId: z.string().uuid(),
});

const createTableSchema = orgBranchSchema.extend({
  number: z.string().trim().min(1, "Numéro requis.").max(20),
  capacity: z.coerce.number().int().min(1).max(50),
});

const updateTableSchema = createTableSchema.extend({
  tableId: z.string().uuid(),
  status: z.enum(HOTEL_RESTAURANT_TABLE_STATUSES),
});

const deleteTableSchema = orgBranchSchema.extend({
  tableId: z.string().uuid(),
});

export async function createMenuCategoryAction(
  input: z.infer<typeof createCategorySchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, name } = parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const existing = await prisma.hotelMenuCategory.findFirst({
    where: { branchId, name },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: "Cette catégorie existe déjà." };
  }

  const maxSort = await prisma.hotelMenuCategory.aggregate({
    where: { branchId },
    _max: { sortOrder: true },
  });

  const created = await prisma.hotelMenuCategory.create({
    data: {
      branchId,
      name,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
    select: { id: true },
  });

  revalidateRestauration(organizationId, branchId);
  return { ok: true, data: created };
}

export async function updateMenuCategoryAction(
  input: z.infer<typeof updateCategorySchema>,
): Promise<ActionResult> {
  const parsed = updateCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, categoryId, name } = parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "update");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const category = await prisma.hotelMenuCategory.findFirst({
    where: { id: categoryId, branchId },
    select: { id: true },
  });
  if (!category) {
    return { ok: false, message: "Catégorie introuvable." };
  }

  const clash = await prisma.hotelMenuCategory.findFirst({
    where: { branchId, name, NOT: { id: categoryId } },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, message: "Cette catégorie existe déjà." };
  }

  await prisma.hotelMenuCategory.update({
    where: { id: categoryId },
    data: { name },
  });

  revalidateRestauration(organizationId, branchId);
  return { ok: true, data: undefined };
}

export async function deleteMenuCategoryAction(
  input: z.infer<typeof deleteCategorySchema>,
): Promise<ActionResult> {
  const parsed = deleteCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, categoryId } = parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "delete");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const category = await prisma.hotelMenuCategory.findFirst({
    where: { id: categoryId, branchId },
    select: { id: true },
  });
  if (!category) {
    return { ok: false, message: "Catégorie introuvable." };
  }

  await prisma.hotelMenuCategory.delete({ where: { id: categoryId } });
  revalidateRestauration(organizationId, branchId);
  return { ok: true, data: undefined };
}

export async function createMenuItemAction(
  input: z.infer<typeof createItemSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const {
    organizationId,
    branchId,
    categoryId,
    name,
    description,
    price,
  } = parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const category = await prisma.hotelMenuCategory.findFirst({
    where: { id: categoryId, branchId },
    select: { id: true },
  });
  if (!category) {
    return { ok: false, message: "Catégorie introuvable." };
  }

  const maxSort = await prisma.hotelMenuItem.aggregate({
    where: { categoryId },
    _max: { sortOrder: true },
  });

  const created = await prisma.hotelMenuItem.create({
    data: {
      categoryId,
      name,
      description: description?.trim() ? description.trim() : null,
      price,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
    select: { id: true },
  });

  revalidateRestauration(organizationId, branchId);
  return { ok: true, data: created };
}

export async function updateMenuItemAction(
  input: z.infer<typeof updateItemSchema>,
): Promise<ActionResult> {
  const parsed = updateItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const {
    organizationId,
    branchId,
    itemId,
    categoryId,
    name,
    description,
    price,
    active,
  } = parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "update");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const item = await prisma.hotelMenuItem.findFirst({
    where: { id: itemId, category: { branchId } },
    select: { id: true },
  });
  if (!item) {
    return { ok: false, message: "Plat introuvable." };
  }

  const category = await prisma.hotelMenuCategory.findFirst({
    where: { id: categoryId, branchId },
    select: { id: true },
  });
  if (!category) {
    return { ok: false, message: "Catégorie introuvable." };
  }

  await prisma.hotelMenuItem.update({
    where: { id: itemId },
    data: {
      categoryId,
      name,
      description: description?.trim() ? description.trim() : null,
      price,
      ...(active === undefined ? {} : { active }),
    },
  });

  revalidateRestauration(organizationId, branchId);
  return { ok: true, data: undefined };
}

export async function deleteMenuItemAction(
  input: z.infer<typeof deleteItemSchema>,
): Promise<ActionResult> {
  const parsed = deleteItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, itemId } = parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "delete");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const item = await prisma.hotelMenuItem.findFirst({
    where: { id: itemId, category: { branchId } },
    select: { id: true },
  });
  if (!item) {
    return { ok: false, message: "Plat introuvable." };
  }

  await prisma.hotelMenuItem.delete({ where: { id: itemId } });
  revalidateRestauration(organizationId, branchId);
  return { ok: true, data: undefined };
}

export async function createFoodOrderAction(
  input: z.infer<typeof createOrderSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const {
    organizationId,
    branchId,
    stayId: stayIdRaw,
    tableId: tableIdRaw,
    notes,
    lines,
  } = parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const stayId = stayIdRaw?.trim() ? stayIdRaw.trim() : null;
  const tableId = tableIdRaw?.trim() ? tableIdRaw.trim() : null;

  if (stayId) {
    const stay = await prisma.hotelStay.findFirst({
      where: { id: stayId, branchId, status: "IN_HOUSE" },
      select: { id: true },
    });
    if (!stay) {
      return { ok: false, message: "Séjour en maison introuvable." };
    }
  }

  if (tableId) {
    const table = await prisma.hotelRestaurantTable.findFirst({
      where: { id: tableId, branchId },
      select: { id: true },
    });
    if (!table) {
      return { ok: false, message: "Table introuvable." };
    }
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
        branchId,
        stayId,
        tableId,
        source: "STAFF_SUR_PLACE",
        status: "NEW",
        notes: notes?.trim() ? notes.trim() : null,
        lines: { create: lineData },
      },
      select: { id: true },
    });

    if (stayId && totalAmount > 0) {
      const label =
        lineData.length === 1
          ? `Restauration — ${lineData[0].name}`
          : `Restauration — ${lineData.length} articles`;
      await tx.hotelFolioLine.create({
        data: {
          stayId,
          label,
          amount: totalAmount,
          kind: "OTHER",
        },
      });
      await tx.hotelStay.update({
        where: { id: stayId },
        data: { totalAmount: { increment: totalAmount } },
      });
    }

    return order;
  });

  revalidateRestauration(organizationId, branchId);
  if (stayId) {
    revalidatePath(hotelRoutes.sejour(organizationId, branchId, stayId), "page");
    revalidatePath(hotelRoutes.sejours(organizationId, branchId), "page");
  }
  return { ok: true, data: created };
}

export async function advanceFoodOrderStatusAction(
  input: z.infer<typeof advanceOrderSchema>,
): Promise<ActionResult> {
  const parsed = advanceOrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, orderId } = parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "update");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const order = await prisma.hotelFoodOrder.findFirst({
    where: { id: orderId, branchId },
    select: { id: true, status: true },
  });
  if (!order) {
    return { ok: false, message: "Commande introuvable." };
  }

  const next = nextFoodOrderStatus(
    order.status as HotelFoodOrderStatusValue,
  );
  if (!next) {
    return { ok: false, message: "Cette commande est déjà servie." };
  }

  await prisma.hotelFoodOrder.update({
    where: { id: orderId },
    data: { status: next },
  });

  revalidateRestauration(organizationId, branchId);
  return { ok: true, data: undefined };
}

export async function createRestaurantTableAction(
  input: z.infer<typeof createTableSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, number, capacity } = parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "create");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const existing = await prisma.hotelRestaurantTable.findFirst({
    where: { branchId, number },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, message: "Ce numéro de table existe déjà." };
  }

  const created = await prisma.hotelRestaurantTable.create({
    data: { branchId, number, capacity },
    select: { id: true },
  });

  revalidateRestauration(organizationId, branchId);
  return { ok: true, data: created };
}

export async function updateRestaurantTableAction(
  input: z.infer<typeof updateTableSchema>,
): Promise<ActionResult> {
  const parsed = updateTableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, tableId, number, capacity, status } =
    parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "update");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const table = await prisma.hotelRestaurantTable.findFirst({
    where: { id: tableId, branchId },
    select: { id: true },
  });
  if (!table) {
    return { ok: false, message: "Table introuvable." };
  }

  const clash = await prisma.hotelRestaurantTable.findFirst({
    where: { branchId, number, NOT: { id: tableId } },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, message: "Ce numéro de table existe déjà." };
  }

  await prisma.hotelRestaurantTable.update({
    where: { id: tableId },
    data: { number, capacity, status },
  });

  revalidateRestauration(organizationId, branchId);
  return { ok: true, data: undefined };
}

export async function deleteRestaurantTableAction(
  input: z.infer<typeof deleteTableSchema>,
): Promise<ActionResult> {
  const parsed = deleteTableSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: zodFirstMessage(parsed.error) };
  }
  const { organizationId, branchId, tableId } = parsed.data;

  const perm = await assertHotelFnbPermission(organizationId, "delete");
  if (!perm.ok) return { ok: false, message: perm.message };

  const access = await assertHotelBranchAccess(organizationId, branchId);
  if (!access.ok) return access;

  const table = await prisma.hotelRestaurantTable.findFirst({
    where: { id: tableId, branchId },
    select: { id: true },
  });
  if (!table) {
    return { ok: false, message: "Table introuvable." };
  }

  await prisma.hotelRestaurantTable.delete({ where: { id: tableId } });
  revalidateRestauration(organizationId, branchId);
  return { ok: true, data: undefined };
}
