-- CreateEnum
CREATE TYPE "HotelTableReservationStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "HotelTableReservation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "tableId" TEXT,
    "guestPrenom" TEXT NOT NULL,
    "guestNom" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "covers" INTEGER NOT NULL DEFAULT 2,
    "status" "HotelTableReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "stayId" TEXT,
    "clientId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelTableReservation_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "HotelFoodOrder" ADD COLUMN "tableReservationId" TEXT;

-- CreateIndex
CREATE INDEX "HotelTableReservation_branchId_startsAt_idx" ON "HotelTableReservation"("branchId", "startsAt");

-- CreateIndex
CREATE INDEX "HotelTableReservation_branchId_status_idx" ON "HotelTableReservation"("branchId", "status");

-- CreateIndex
CREATE INDEX "HotelTableReservation_tableId_idx" ON "HotelTableReservation"("tableId");

-- CreateIndex
CREATE INDEX "HotelTableReservation_stayId_idx" ON "HotelTableReservation"("stayId");

-- CreateIndex
CREATE INDEX "HotelTableReservation_clientId_idx" ON "HotelTableReservation"("clientId");

-- CreateIndex
CREATE INDEX "HotelFoodOrder_tableReservationId_idx" ON "HotelFoodOrder"("tableReservationId");

-- AddForeignKey
ALTER TABLE "HotelTableReservation" ADD CONSTRAINT "HotelTableReservation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelTableReservation" ADD CONSTRAINT "HotelTableReservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "HotelRestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelTableReservation" ADD CONSTRAINT "HotelTableReservation_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "HotelStay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelTableReservation" ADD CONSTRAINT "HotelTableReservation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelFoodOrder" ADD CONSTRAINT "HotelFoodOrder_tableReservationId_fkey" FOREIGN KEY ("tableReservationId") REFERENCES "HotelTableReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
