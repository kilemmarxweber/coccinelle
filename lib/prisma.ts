import { PrismaClient } from "../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

/** Incrémenter après tout changement de modèle Prisma pour invalider le singleton HMR. */
const PRISMA_SCHEMA_REV = 14;

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

/**
 * Recrée le client si le singleton HMR est resté sur un schéma plus ancien
 * (ex. après ajout de champs HotelOrder.preparedByUserId).
 */
function resolvePrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  const staleRev = globalForPrisma.prismaSchemaRev !== PRISMA_SCHEMA_REV;
  const staleDelegate =
    existing &&
    typeof (existing as { hotelMenuItem?: unknown }).hotelMenuItem ===
      "undefined";

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
      !modelHasField(existing, "Folio", "checkoutQueuedAt"));

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
