import { PrismaClient } from "../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma() {
  return new PrismaClient({
    adapter,
  });
}

/**
 * Recrée le client si le singleton HMR est resté sur un schéma plus ancien
 * (ex. après ajout de HotelMenuItem / CashSession).
 */
function resolvePrisma(): PrismaClient {
  const existing = globalForPrisma.prisma;
  if (existing && typeof (existing as { hotelMenuItem?: unknown }).hotelMenuItem === "undefined") {
    void existing.$disconnect().catch(() => undefined);
    globalForPrisma.prisma = undefined;
  }

  const client = globalForPrisma.prisma ?? createPrisma();
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = client;
  }
  return client;
}

export const prisma = resolvePrisma();

export default prisma;
