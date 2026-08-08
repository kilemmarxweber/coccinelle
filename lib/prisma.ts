import { PrismaClient } from "../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

/** Incrémenter après tout changement de modèle Prisma pour invalider le singleton HMR. */
const PRISMA_SCHEMA_REV = 3;

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

  if (existing && (staleRev || staleDelegate)) {
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
