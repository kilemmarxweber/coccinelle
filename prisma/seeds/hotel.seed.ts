"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

const ORG_ID = "org-1";
const BRANCH_CODE = "HTL-DEMO";
const BRANCH_ID = "branch-hotel-demo-1";

/** Unsplash — URLs stables (crop + format). */
const IMG = {
  standard:
    "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=800&h=600&fit=crop&auto=format",
  suite:
    "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&h=600&fit=crop&auto=format",
  deluxe:
    "https://images.unsplash.com/photo-1590490360182-c33d57733427?w=800&h=600&fit=crop&auto=format",
  poulet:
    "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=800&h=600&fit=crop&auto=format",
  poisson:
    "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=800&h=600&fit=crop&auto=format",
  salade:
    "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop&auto=format",
  jus:
    "https://images.unsplash.com/photo-1623065422902-30a2d94efe66?w=800&h=600&fit=crop&auto=format",
} as const;

type RoomTypeSeed = {
  name: string;
  description: string;
  capacity: number;
  priceNight: number;
  imageUrl: string;
  rooms: Array<{ number: string; floor: string }>;
};

const ROOM_TYPES: RoomTypeSeed[] = [
  {
    name: "Chambre Standard",
    description: "Lit double, salle d’eau, Wi-Fi",
    capacity: 2,
    priceNight: 85_000,
    imageUrl: IMG.standard,
    rooms: [
      { number: "101", floor: "1" },
      { number: "102", floor: "1" },
      { number: "201", floor: "2" },
    ],
  },
  {
    name: "Chambre Deluxe",
    description: "Vue jardin, bureau, mini-bar",
    capacity: 2,
    priceNight: 120_000,
    imageUrl: IMG.deluxe,
    rooms: [
      { number: "202", floor: "2" },
      { number: "203", floor: "2" },
    ],
  },
  {
    name: "Suite",
    description: "Salon + chambre, mini-bar",
    capacity: 3,
    priceNight: 180_000,
    imageUrl: IMG.suite,
    rooms: [{ number: "301", floor: "3" }],
  },
];

type MenuItemSeed = {
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  sortOrder: number;
};

type MenuCategorySeed = {
  name: string;
  sortOrder: number;
  items: MenuItemSeed[];
};

const MENU: MenuCategorySeed[] = [
  {
    name: "Plats",
    sortOrder: 0,
    items: [
      {
        name: "Poulet à la moambe",
        description: "Sauce arachide, riz, plantain",
        price: 18_000,
        imageUrl: IMG.poulet,
        sortOrder: 0,
      },
      {
        name: "Poisson grillé",
        description: "Tilapia, légumes de saison",
        price: 22_000,
        imageUrl: IMG.poisson,
        sortOrder: 1,
      },
    ],
  },
  {
    name: "Entrées & boissons",
    sortOrder: 1,
    items: [
      {
        name: "Salade fraîche",
        description: "Légumes locaux, vinaigrette",
        price: 8_000,
        imageUrl: IMG.salade,
        sortOrder: 0,
      },
      {
        name: "Jus de fruits",
        description: "Ananas ou bissap",
        price: 4_000,
        imageUrl: IMG.jus,
        sortOrder: 1,
      },
    ],
  },
];

const TABLES = [
  { number: "T1", capacity: 2 },
  { number: "T2", capacity: 4 },
  { number: "T3", capacity: 4 },
  { number: "T4", capacity: 6 },
] as const;

/**
 * Seed démo hôtel (units-12) — idempotent.
 * Réutilise une branche HOTEL active si elle existe, sinon en crée une.
 * Types/chambres, carte F&B + tables, avec imageUrl.
 */
export async function seedHotel() {
  const org = await prisma.organization.findUnique({
    where: { id: ORG_ID },
    select: { id: true },
  });
  if (!org) {
    console.log("⚠️ seedHotel: org-1 absente — lancez seedOrganization d’abord.");
    return;
  }

  let branch = await prisma.branch.findFirst({
    where: {
      organizationId: ORG_ID,
      type: "HOTEL",
      status: "ACTIVE",
    },
    orderBy: { createdAt: "asc" },
  });

  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        id: BRANCH_ID,
        organizationId: ORG_ID,
        type: "HOTEL",
        name: "Hôtel Coccinelle Demo",
        code: BRANCH_CODE,
        status: "ACTIVE",
        city: "Kinshasa",
        address: "Avenue de la Libération",
        phone: "+243900000100",
        timezone: "Africa/Kinshasa",
        settings: {
          bootstrappedAt: new Date().toISOString(),
          module: "HOTEL",
          cashpayeEnabled: true,
          seed: "units-12",
        },
      },
    });
  } else {
    branch = await prisma.branch.update({
      where: { id: branch.id },
      data: {
        city: branch.city ?? "Kinshasa",
        address: branch.address ?? "Avenue de la Libération",
        phone: branch.phone ?? "+243900000100",
      },
    });
  }

  // Évite une 2ᵉ branche HOTEL créée par une ancienne version du seed.
  await prisma.branch.updateMany({
    where: {
      organizationId: ORG_ID,
      type: "HOTEL",
      code: BRANCH_CODE,
      id: { not: branch.id },
    },
    data: { status: "CLOSED" },
  });

  for (const rt of ROOM_TYPES) {
    let roomType = await prisma.hotelRoomType.findFirst({
      where: { branchId: branch.id, name: rt.name },
    });
    if (roomType) {
      roomType = await prisma.hotelRoomType.update({
        where: { id: roomType.id },
        data: {
          description: rt.description,
          capacity: rt.capacity,
          priceNight: rt.priceNight,
          imageUrl: rt.imageUrl,
        },
      });
    } else {
      roomType = await prisma.hotelRoomType.create({
        data: {
          branchId: branch.id,
          name: rt.name,
          description: rt.description,
          capacity: rt.capacity,
          priceNight: rt.priceNight,
          imageUrl: rt.imageUrl,
        },
      });
    }

    for (const room of rt.rooms) {
      await prisma.hotelRoom.upsert({
        where: {
          roomTypeId_number: {
            roomTypeId: roomType.id,
            number: room.number,
          },
        },
        update: { floor: room.floor },
        create: {
          roomTypeId: roomType.id,
          number: room.number,
          floor: room.floor,
          status: "AVAILABLE",
        },
      });
    }
  }

  for (const cat of MENU) {
    const category = await prisma.hotelMenuCategory.upsert({
      where: {
        branchId_name: { branchId: branch.id, name: cat.name },
      },
      update: { sortOrder: cat.sortOrder },
      create: {
        branchId: branch.id,
        name: cat.name,
        sortOrder: cat.sortOrder,
      },
    });

    for (const item of cat.items) {
      const existing = await prisma.hotelMenuItem.findFirst({
        where: { categoryId: category.id, name: item.name },
      });
      if (existing) {
        await prisma.hotelMenuItem.update({
          where: { id: existing.id },
          data: {
            description: item.description,
            price: item.price,
            imageUrl: item.imageUrl,
            active: true,
            sortOrder: item.sortOrder,
          },
        });
      } else {
        await prisma.hotelMenuItem.create({
          data: {
            categoryId: category.id,
            name: item.name,
            description: item.description,
            price: item.price,
            imageUrl: item.imageUrl,
            active: true,
            sortOrder: item.sortOrder,
          },
        });
      }
    }
  }

  for (const table of TABLES) {
    await prisma.hotelRestaurantTable.upsert({
      where: {
        branchId_number: { branchId: branch.id, number: table.number },
      },
      update: { capacity: table.capacity, status: "FREE" },
      create: {
        branchId: branch.id,
        number: table.number,
        capacity: table.capacity,
        status: "FREE",
      },
    });
  }

  console.log(
    `✅ Hotel seed: ${branch.name} (${branch.code}) — chambres, carte F&B, tables + images`,
  );
}
