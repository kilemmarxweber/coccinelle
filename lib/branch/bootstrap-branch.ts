/**
 * Bootstrap des éléments initiaux selon BranchType + modules.
 */

import type { PrismaClient, BranchType } from "../../prisma/generated/prisma/client";
import { DEFAULT_HOTEL_MENU } from "@/lib/hotel/default-menu";
import { isHospitality } from "@/lib/branch/hospitality";
import type { AgencyFlags, ShopFlags } from "@/lib/branch/agency-shop";

type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export type BootstrapBranchInput = {
  organizationId: string;
  branchId: string;
  type: BranchType;
  hasStays?: boolean;
  hasRestaurant?: boolean;
  hasAvion?: boolean;
  hasBus?: boolean;
  hasBateau?: boolean;
  hasPharmacie?: boolean;
  hasShop?: boolean;
  hasAlimentation?: boolean;
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
  menuItemsCreated: number;
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
    menuItemsCreated: 0,
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

  const agency: AgencyFlags = {
    hasAvion: input.hasAvion === true,
    hasBus: input.hasBus === true,
    hasBateau: input.hasBateau === true,
  };
  const shop: ShopFlags = {
    hasPharmacie: input.hasPharmacie === true,
    hasShop: input.hasShop === true,
    hasAlimentation: input.hasAlimentation === true,
  };

  const hasStays = input.hasStays ?? input.type === "HOTEL";
  const hasRestaurant =
    input.hasRestaurant ??
    (input.type === "HOTEL" || input.type === "RESTAURANT");

  if (!seedDemo) {
    await db.branch.update({
      where: { id: input.branchId },
      data: {
        settings: {
          bootstrappedAt: new Date().toISOString(),
          module: input.type,
          cashpayeEnabled: true,
          hasStays,
          hasRestaurant,
          ...agency,
          ...shop,
        },
      },
    });
    return result;
  }

  if (input.type === "AGENCE") {
    const creates = [];
    if (agency.hasAvion) {
      creates.push(
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
      );
    }
    if (agency.hasBus) {
      creates.push(
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
      );
    }
    if (agency.hasBateau) {
      creates.push(
        db.trajet.create({
          data: {
            organizationId: input.organizationId,
            branchId: input.branchId,
            villeDepart: "Kinshasa",
            villeArrivee: "Mbandaka",
            modeTransport: "BATEAU",
            kilosGratuits: 30,
            prixParKilo: 1.5,
            prixBase: 55,
            dureeEstimee: 720,
          },
        }),
      );
    }
    const trajets = await Promise.all(creates);
    result.trajetsCreated = trajets.length;
  }

  if (isHospitality(input.type) && hasStays) {
    const standard = await db.hotelRoomType.create({
      data: {
        branchId: input.branchId,
        name: "Chambre Standard",
        description: "Lit double, salle d’eau, Wi-Fi",
        capacity: 2,
        priceNight: 85,
        kind: "ROOM",
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
        kind: "ROOM",
        rooms: {
          create: [{ number: "301", floor: "3" }],
        },
      },
      include: { rooms: true },
    });
    const meeting = await db.hotelRoomType.create({
      data: {
        branchId: input.branchId,
        name: "Salle conférence",
        description: "Vidéoprojecteur · places simples + VIP",
        capacity: 24,
        seatsStandard: 20,
        seatsVip: 4,
        priceNight: 120,
        kind: "MEETING",
        rooms: {
          create: [
            { number: "R1", floor: "RDC" },
            { number: "R2", floor: "1" },
          ],
        },
      },
      include: { rooms: true },
    });
    const boardroom = await db.hotelRoomType.create({
      data: {
        branchId: input.branchId,
        name: "Boardroom VIP",
        description: "Salon direction · majoritairement VIP",
        capacity: 12,
        seatsStandard: 4,
        seatsVip: 8,
        priceNight: 200,
        kind: "MEETING",
        rooms: {
          create: [{ number: "VIP-A", floor: "2" }],
        },
      },
      include: { rooms: true },
    });
    result.roomTypesCreated = 4;
    result.roomsCreated =
      standard.rooms.length +
      suite.rooms.length +
      meeting.rooms.length +
      boardroom.rooms.length;
  }

  if (isHospitality(input.type) && hasRestaurant) {
    await db.hotelMenuItem.createMany({
      data: DEFAULT_HOTEL_MENU.map((item) => ({
        branchId: input.branchId,
        ...item,
        stockQty: 50,
      })),
    });
    result.menuItemsCreated = DEFAULT_HOTEL_MENU.length;
  }

  if (isHospitality(input.type)) {
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
    let categoriesCreated = 0;
    let productsCreated = 0;

    if (shop.hasPharmacie) {
      const cat = await db.shopCategory.create({
        data: {
          branchId: input.branchId,
          name: "Pharmacie",
          products: {
            create: [
              {
                branchId: input.branchId,
                name: "Paracétamol 500mg",
                sku: "PHA-PARA",
                kind: "ARTICLE",
                price: 1.2,
                stockQty: 200,
              },
              {
                branchId: input.branchId,
                name: "Sérum physiologique",
                sku: "PHA-SER",
                kind: "ARTICLE",
                price: 0.8,
                stockQty: 120,
              },
            ],
          },
        },
        include: { products: true },
      });
      categoriesCreated += 1;
      productsCreated += cat.products.length;
    }
    if (shop.hasShop) {
      const cat = await db.shopCategory.create({
        data: {
          branchId: input.branchId,
          name: "Boutique",
          products: {
            create: [
              {
                branchId: input.branchId,
                name: "Carte SIM",
                sku: "SIM-01",
                kind: "ARTICLE",
                price: 5,
                stockQty: 25,
              },
              {
                branchId: input.branchId,
                name: "Chargeur USB",
                sku: "CHG-01",
                kind: "ARTICLE",
                price: 8,
                stockQty: 40,
              },
            ],
          },
        },
        include: { products: true },
      });
      categoriesCreated += 1;
      productsCreated += cat.products.length;
    }
    if (shop.hasAlimentation) {
      const cat = await db.shopCategory.create({
        data: {
          branchId: input.branchId,
          name: "Alimentation",
          products: {
            create: [
              {
                branchId: input.branchId,
                name: "Eau 1.5L",
                sku: "EAU-15",
                kind: "ARTICLE",
                price: 1.5,
                stockQty: 100,
              },
              {
                branchId: input.branchId,
                name: "Riz 1kg",
                sku: "RIZ-01",
                kind: "ARTICLE",
                price: 2.2,
                stockQty: 80,
              },
              {
                branchId: input.branchId,
                name: "Huile 1L",
                sku: "HUI-01",
                kind: "ARTICLE",
                price: 3.5,
                stockQty: 60,
              },
              {
                branchId: input.branchId,
                name: "Plat du jour",
                sku: "PLAT-01",
                kind: "PLAT",
                price: 5,
                promoActive: true,
                promoPrice: 4,
                promoLabel: "Midi",
                stockQty: 30,
              },
              {
                branchId: input.branchId,
                name: "Riz sauce",
                sku: "PLAT-02",
                kind: "PLAT",
                price: 4.5,
                stockQty: 25,
              },
            ],
          },
        },
        include: { products: true },
      });
      categoriesCreated += 1;
      productsCreated += cat.products.length;
    }

    result.categoriesCreated = categoriesCreated;
    result.productsCreated = productsCreated;
  }

  await db.branch.update({
    where: { id: input.branchId },
    data: {
      settings: {
        bootstrappedAt: new Date().toISOString(),
        module: input.type,
        cashpayeEnabled: true,
        hasStays,
        hasRestaurant,
        ...agency,
        ...shop,
      },
    },
  });

  return result;
}
