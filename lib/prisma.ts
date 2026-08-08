import { PrismaClient } from "../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Bump when the Prisma schema gains models/delegates so Next.js HMR
 * does not keep a stale `PrismaClient` on `globalThis` (missing delegates
 * → `Cannot read properties of undefined (reading 'findMany')`).
 */
const PRISMA_CLIENT_GENERATION = 2;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaGeneration?: number;
};

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  });
  return new PrismaClient({ adapter });
}

const cached =
  globalForPrisma.prismaGeneration === PRISMA_CLIENT_GENERATION
    ? globalForPrisma.prisma
    : undefined;

export const prisma = cached ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.prismaGeneration = PRISMA_CLIENT_GENERATION;
}

export default prisma;
