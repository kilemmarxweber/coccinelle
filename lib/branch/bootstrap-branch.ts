/**
 * Bootstrap des éléments initiaux selon BranchType (B02).
 */

import type { PrismaClient, BranchType } from "../../prisma/generated/prisma/client";

type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export type BootstrapBranchInput = {
  organizationId: string;
  branchId: string;
  type: BranchType;
  /** Crée des données démo (trajets / chambres / produits). Défaut true. */
  seedDemo?: boolean;
  /** Member id du créateur (owner) à rattacher comme branch_manager. */
  creatorMemberId?: string | null;
};

export type BootstrapBranchResult = {
  branchMembersCreated: number;
  trajetsCreated: number;
  roomTypesCreated: number;
  roomsCreated: number;
  categoriesCreated: number;
  productsCreated: number;
};

export async function bootstrapBranchByType(
  db: Db,
  input: BootstrapBranchInput,
): Promise<BootstrapBranchResult> {
  const seedDemo = input.seedDemo !== false;
  const result: BootstrapBranchResult = {
    branchMembersCreated: 0,
    trajetsCreated: 0,
    roomTypesCreated: 0,
    roomsCreated: 0,
    categoriesCreated: 0,
    productsCreated: 0,
  };

  if (input.creatorMemberId) {
    await db.branchMember.create({
      data: {
        branchId: input.branchId,
        memberId: input.creatorMemberId,
        role: "branch_manager",
        isPrimary: true,
        status: "ACTIVE",
      },
    });
    result.branchMembersCreated = 1;
  }

  if (!seedDemo) return result;

  if (input.type === "AGENCE") {
    const trajets = await Promise.all([
      db.trajet.create({
        data: {
          organizationId: input.organizationId,
          branchId: input.branchId,
          villeDepart: "Kinshasa",
          villeArrivee: "Lubumbashi",
          modeTransport: "AVION",
          kilosGratuits: 20,
          prixParKilo: 5,
          prixBase: 350,
          dureeEstimee: 120,
        },
      }),
      db.trajet.create({
        data: {
          organizationId: input.organizationId,
          branchId: input.branchId,
          villeDepart: "Kinshasa",
          villeArrivee: "Matadi",
          modeTransport: "BUS",
          kilosGratuits: 15,
          prixParKilo: 2,
          prixBase: 45,
          dureeEstimee: 240,
        },
      }),
    ]);
    result.trajetsCreated = trajets.length;
  }

  if (input.type === "HOTEL") {
    const standard = await db.hotelRoomType.create({
      data: {
        branchId: input.branchId,
        name: "Chambre Standard",
        description: "Lit double, salle d’eau, Wi-Fi",
        capacity: 2,
        priceNight: 85,
        rooms: {
          create: [
            { number: "101", floor: "1" },
            { number: "102", floor: "1" },
            { number: "201", floor: "2" },
          ],
        },
      },
      include: { rooms: true },
    });
    const suite = await db.hotelRoomType.create({
      data: {
        branchId: input.branchId,
        name: "Suite",
        description: "Salon + chambre, mini-bar",
        capacity: 3,
        priceNight: 160,
        rooms: {
          create: [{ number: "301", floor: "3" }],
        },
      },
      include: { rooms: true },
    });
    result.roomTypesCreated = 2;
    result.roomsCreated = standard.rooms.length + suite.rooms.length;

    await db.hotelMenuItem.createMany({
      data: [
        {
          branchId: input.branchId,
          name: "Petit-déjeuner",
          category: "Restauration",
          price: 12,
          needsKitchen: true,
        },
        {
          branchId: input.branchId,
          name: "Plat du jour",
          category: "Restauration",
          price: 18,
          needsKitchen: true,
        },
        {
          branchId: input.branchId,
          name: "Eau minérale",
          category: "Boissons",
          price: 1.5,
          needsKitchen: false,
        },
        {
          branchId: input.branchId,
          name: "Jus local",
          category: "Boissons",
          price: 2.5,
          needsKitchen: false,
        },
        {
          branchId: input.branchId,
          name: "Bière locale",
          category: "Boissons",
          price: 3,
          needsKitchen: false,
        },
      ],
    });

    await db.exchangeRate.create({
      data: {
        branchId: input.branchId,
        fromCurrency: "USD",
        toCurrency: "CDF",
        rate: 2850,
      },
    });
  }

  if (input.type === "BOUTIQUE") {
    const boissons = await db.shopCategory.create({
      data: {
        branchId: input.branchId,
        name: "Boissons",
        products: {
          create: [
            { name: "Eau 1.5L", sku: "EAU-15", price: 1.5, stockQty: 100 },
            { name: "Jus local", sku: "JUS-01", price: 2.5, stockQty: 40 },
          ],
        },
      },
      include: { products: true },
    });
    const divers = await db.shopCategory.create({
      data: {
        branchId: input.branchId,
        name: "Divers",
        products: {
          create: [
            { name: "Carte SIM", sku: "SIM-01", price: 5, stockQty: 25 },
            { name: "Snack", sku: "SNK-01", price: 1, stockQty: 80 },
          ],
        },
      },
      include: { products: true },
    });
    result.categoriesCreated = 2;
    result.productsCreated = boissons.products.length + divers.products.length;
  }

  await db.branch.update({
    where: { id: input.branchId },
    data: {
      settings: {
        bootstrappedAt: new Date().toISOString(),
        module: input.type,
        cashpayeEnabled: true,
      },
    },
  });

  return result;
}
