import { PrismaClient } from "../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

/** Incrémenter après tout changement de modèle Prisma pour invalider le singleton HMR. */
const PRISMA_SCHEMA_REV = 6;

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaRev: number | undefined;
};

function createPrisma() {
  return new PrismaClient({
    adapter,
  });
}

/**
 * Recrée le client si le singleton HMR est resté sur un schéma plus ancien
 * (ex. après ajout de champs HotelOrder.prepStartedAt).
 */
function resolvePrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  const staleRev = globalForPrisma.prismaSchemaRev !== PRISMA_SCHEMA_REV;
  const staleDelegate =
    existing &&
    typeof (existing as { hotelMenuItem?: unknown }).hotelMenuItem ===
      "undefined";

  let staleMenuFields = false;
  if (existing) {
    const fields = (
      existing as {
        _runtimeDataModel?: {
          models?: Record<
            string,
            { fields?: Array<{ name?: string }> | Record<string, unknown> }
          >;
        };
      }
    )._runtimeDataModel?.models?.HotelMenuItem?.fields;
    if (Array.isArray(fields)) {
      staleMenuFields = !fields.some((f) => f.name === "isConsumable");
    } else if (fields && typeof fields === "object") {
      staleMenuFields = !("isConsumable" in fields);
    }
  }

  if (existing && (staleRev || staleDelegate || staleMenuFields)) {
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
