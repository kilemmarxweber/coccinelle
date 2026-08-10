import prisma from "@/lib/prisma";

export type LandingRoomType = {
  id: string;
  name: string;
  description: string | null;
  capacity: number;
  priceNight: number;
  imageUrl: string | null;
};

export type LandingMenuItem = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  categoryName: string;
};

export type HotelLandingContent = {
  roomTypes: LandingRoomType[];
  featuredDishes: LandingMenuItem[];
};

/** Contenu featured pour la landing client hôtel (units-12). */
export async function listHotelLandingContent(
  branchId: string,
): Promise<HotelLandingContent> {
  const [roomTypes, dishes] = await Promise.all([
    prisma.hotelRoomType.findMany({
      where: { branchId },
      orderBy: { priceNight: "asc" },
      select: {
        id: true,
        name: true,
        description: true,
        capacity: true,
        priceNight: true,
        imageUrl: true,
      },
    }),
    prisma.hotelMenuItem.findMany({
      where: {
        active: true,
        category: { branchId },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 6,
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        imageUrl: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  return {
    roomTypes,
    featuredDishes: dishes.map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description,
      price: d.price,
      imageUrl: d.imageUrl,
      categoryName: d.category.name,
    })),
  };
}
