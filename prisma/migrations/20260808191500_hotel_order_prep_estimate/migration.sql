-- AlterTable
ALTER TABLE "HotelOrder" ADD COLUMN IF NOT EXISTS "prepStartedAt" TIMESTAMP(3);
ALTER TABLE "HotelOrder" ADD COLUMN IF NOT EXISTS "estimatedMinutes" INTEGER;
