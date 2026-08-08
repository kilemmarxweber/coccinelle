import prisma from "@/lib/prisma";
import {
  guestDisplayName,
} from "@/lib/hotel/stay-status";
import type { HotelFoodOrderStatusValue } from "@/lib/hotel/food-order-status";
import {
  computeBalance,
  roundMoney,
} from "@/lib/hotel/payment-method";
import type { HotelRestaurantTableStatusValue } from "@/lib/hotel/table-status";

export type MenuItemView = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  active: boolean;
  sortOrder: number;
};

export type MenuCategoryView = {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuItemView[];
};

export type FoodOrderLineView = {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
};

export type FoodOrderView = {
  id: string;
  status: HotelFoodOrderStatusValue;
  source: "STAFF_SUR_PLACE" | "CLIENT_ONLINE";
  notes: string | null;
  createdAt: Date;
  stayId: string | null;
  stayGuestName: string | null;
  stayRoomNumber: string | null;
  tableId: string | null;
  tableNumber: string | null;
  lines: FoodOrderLineView[];
  totalAmount: number;
  /** Commandes liées à un séjour : règlement via folio, pas via ticket. */
  billedToFolio: boolean;
  paidAmount: number;
  balanceAmount: number;
};

export type RestaurantTableView = {
  id: string;
  number: string;
  capacity: number;
  status: HotelRestaurantTableStatusValue;
};

export type FnbFormOptions = {
  activeItems: Array<{
    id: string;
    name: string;
    price: number;
    categoryName: string;
  }>;
  inHouseStays: Array<{
    id: string;
    guestName: string;
    roomNumber: string | null;
  }>;
  tables: Array<{
    id: string;
    number: string;
    capacity: number;
  }>;
};

export async function listMenuCategories(
  branchId: string,
): Promise<MenuCategoryView[]> {
  const rows = await prisma.hotelMenuCategory.findMany({
    where: { branchId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      },
    },
  });

  return rows.map((cat) => ({
    id: cat.id,
    name: cat.name,
    sortOrder: cat.sortOrder,
    items: cat.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      active: item.active,
      sortOrder: item.sortOrder,
    })),
  }));
}

export async function listFoodOrders(
  branchId: string,
): Promise<FoodOrderView[]> {
  const rows = await prisma.hotelFoodOrder.findMany({
    where: {
      branchId,
      status: { not: "SERVED" },
    },
    orderBy: [{ createdAt: "asc" }],
    include: {
      lines: { orderBy: { createdAt: "asc" } },
      stay: {
        select: {
          guestPrenom: true,
          guestNom: true,
          room: { select: { number: true } },
        },
      },
      table: { select: { number: true } },
      payments: {
        where: { status: "PAYE" },
        select: { amount: true },
      },
    },
  });

  return rows.map((row) => {
    const lines = row.lines.map((line) => ({
      id: line.id,
      name: line.name,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
    }));
    const totalAmount = roundMoney(
      lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0),
    );
    const billedToFolio = Boolean(row.stayId);
    const paidAmount = billedToFolio
      ? 0
      : roundMoney(row.payments.reduce((sum, p) => sum + p.amount, 0));
    return {
      id: row.id,
      status: row.status as HotelFoodOrderStatusValue,
      source: row.source as "STAFF_SUR_PLACE" | "CLIENT_ONLINE",
      notes: row.notes,
      createdAt: row.createdAt,
      stayId: row.stayId,
      stayGuestName: row.stay
        ? guestDisplayName(row.stay.guestPrenom, row.stay.guestNom)
        : null,
      stayRoomNumber: row.stay?.room?.number ?? null,
      tableId: row.tableId,
      tableNumber: row.table?.number ?? null,
      lines,
      totalAmount,
      billedToFolio,
      paidAmount,
      balanceAmount: billedToFolio
        ? 0
        : computeBalance(totalAmount, paidAmount),
    };
  });
}

export async function listRestaurantTables(
  branchId: string,
): Promise<RestaurantTableView[]> {
  const rows = await prisma.hotelRestaurantTable.findMany({
    where: { branchId },
    orderBy: [{ number: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    capacity: row.capacity,
    status: row.status as HotelRestaurantTableStatusValue,
  }));
}

export async function listFnbFormOptions(
  branchId: string,
): Promise<FnbFormOptions> {
  const [items, stays, tables] = await Promise.all([
    prisma.hotelMenuItem.findMany({
      where: { active: true, category: { branchId } },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      include: { category: { select: { name: true } } },
    }),
    prisma.hotelStay.findMany({
      where: { branchId, status: "IN_HOUSE" },
      orderBy: [{ guestNom: "asc" }, { guestPrenom: "asc" }],
      include: { room: { select: { number: true } } },
    }),
    prisma.hotelRestaurantTable.findMany({
      where: { branchId },
      orderBy: { number: "asc" },
      select: { id: true, number: true, capacity: true },
    }),
  ]);

  return {
    activeItems: items.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      categoryName: item.category.name,
    })),
    inHouseStays: stays.map((stay) => ({
      id: stay.id,
      guestName: guestDisplayName(stay.guestPrenom, stay.guestNom),
      roomNumber: stay.room?.number ?? null,
    })),
    tables,
  };
}
