import { PrismaClient } from "../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

/** Incrémenter après tout changement de modèle Prisma pour invalider le singleton HMR. */
const PRISMA_SCHEMA_REV = 30;

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaRev: number | undefined;
};

function createPrisma() {
  return new PrismaClient({
    adapter,
  });
}

function modelHasField(
  client: PrismaClient,
  model: string,
  field: string,
): boolean {
  const fields = (
    client as {
      _runtimeDataModel?: {
        models?: Record<
          string,
          { fields?: Array<{ name?: string }> | Record<string, unknown> }
        >;
      };
    }
  )._runtimeDataModel?.models?.[model]?.fields;
  if (Array.isArray(fields)) {
    return fields.some((f) => f.name === field);
  }
  if (fields && typeof fields === "object") {
    return field in fields;
  }
  // Si on ne peut pas inspecter, considérer à jour (évite boucle).
  return true;
}

function enumHasValue(
  client: PrismaClient,
  enumName: string,
  value: string,
): boolean {
  const enums = (
    client as {
      _runtimeDataModel?: {
        enums?: Record<
          string,
          { values?: Array<{ name?: string } | string> } | string[]
        >;
      };
    }
  )._runtimeDataModel?.enums?.[enumName];
  if (!enums) return true;
  const values = Array.isArray(enums)
    ? enums
    : Array.isArray(enums.values)
      ? enums.values
      : [];
  return values.some((v) =>
    typeof v === "string" ? v === value : v?.name === value,
  );
}

/**
 * Recrée le client si le singleton HMR est resté sur un schéma plus ancien
 * (ex. après ajout de champs HotelOrder.preparedByUserId).
 */
function resolvePrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  const staleRev = globalForPrisma.prismaSchemaRev !== PRISMA_SCHEMA_REV;
  const staleDelegate =
    existing &&
    (typeof (existing as { hotelMenuItem?: unknown }).hotelMenuItem ===
      "undefined" ||
      typeof (existing as { shopSale?: unknown }).shopSale === "undefined" ||
      typeof (existing as { shopProduct?: unknown }).shopProduct ===
        "undefined");

  const staleFields =
    existing &&
    (!modelHasField(existing, "HotelMenuItem", "isConsumable") ||
      !modelHasField(existing, "HotelStockMovement", "stockBefore") ||
      !modelHasField(existing, "HotelOrder", "preparedByUserId") ||
      !modelHasField(existing, "Branch", "imageUrl") ||
      !modelHasField(existing, "Branch", "hasStays") ||
      !modelHasField(existing, "Branch", "hasRestaurant") ||
      !modelHasField(existing, "HotelMenuItem", "createdByUserId") ||
      !modelHasField(existing, "Branch", "hasAvion") ||
      !modelHasField(existing, "Branch", "hasShop") ||
      !modelHasField(existing, "HotelOrder", "settlementMode") ||
      !modelHasField(existing, "Folio", "checkoutQueuedAt") ||
      !modelHasField(existing, "HotelStay", "billingMode") ||
      !modelHasField(existing, "HotelStay", "catalogUnitPrice") ||
      !modelHasField(existing, "HotelRoomType", "kind") ||
      !modelHasField(existing, "HotelRoomType", "seatsVip") ||
      !modelHasField(existing, "HotelRoomType", "seatsStandard") ||
      !modelHasField(existing, "ShopProduct", "kind") ||
      !modelHasField(existing, "ShopProduct", "promoActive") ||
      !modelHasField(existing, "ShopProduct", "branchId") ||
      !modelHasField(existing, "Payment", "shopSaleId") ||
      !enumHasValue(existing, "FolioLineKind", "STAY_OVERTIME") ||
      !enumHasValue(existing, "FolioLineKind", "DEPOSIT") ||
      !modelHasField(existing, "HotelStay", "depositAmountExpected") ||
      !enumHasValue(existing, "ShopProductKind", "PLAT") ||
      !modelHasField(existing, "BranchExpense", "kind") ||
      !modelHasField(existing, "BranchExpense", "number") ||
      !modelHasField(existing, "HotelMenuItem", "storageZone") ||
      !modelHasField(existing, "ServiceStockSession", "vendorUserId") ||
      !modelHasField(existing, "HotelStay", "partnerId") ||
      !modelHasField(existing, "HotelStay", "idDocumentImageUrl") ||
      !modelHasField(existing, "HotelStay", "checkoutReminderSentAt") ||
      !modelHasField(existing, "User", "phone") ||
      !modelHasField(existing, "BranchRole", "slug") ||
      !enumHasValue(existing, "PrivilegeAction", "VIEW") ||
      !enumHasValue(existing, "PaymentMethod", "BANK") ||
      !enumHasValue(existing, "IdDocumentType", "CNI"));

  if (existing && (staleRev || staleDelegate || staleFields)) {
    void existing.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = undefined;
  }

  const client = globalForPrisma.prisma ?? createPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
    globalForPrisma.prismaSchemaRev = PRISMA_SCHEMA_REV;
  }
  return client;
}

export const prisma = resolvePrisma();

export default prisma;
