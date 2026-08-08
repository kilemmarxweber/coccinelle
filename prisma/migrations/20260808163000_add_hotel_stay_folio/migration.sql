-- CreateEnum
CREATE TYPE "HotelStayStatus" AS ENUM ('BOOKED', 'IN_HOUSE', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HotelFolioLineKind" AS ENUM ('NIGHT', 'OTHER');

-- CreateTable
CREATE TABLE "HotelStay" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "roomId" TEXT,
    "guestPrenom" TEXT NOT NULL,
    "guestNom" TEXT NOT NULL,
    "guestPhone" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "status" "HotelStayStatus" NOT NULL DEFAULT 'BOOKED',
    "priceNight" DOUBLE PRECISION NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelStay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelFolioLine" (
    "id" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "kind" "HotelFolioLineKind" NOT NULL DEFAULT 'NIGHT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelFolioLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HotelStay_branchId_status_idx" ON "HotelStay"("branchId", "status");

-- CreateIndex
CREATE INDEX "HotelStay_branchId_checkInDate_idx" ON "HotelStay"("branchId", "checkInDate");

-- CreateIndex
CREATE INDEX "HotelStay_roomId_idx" ON "HotelStay"("roomId");

-- CreateIndex
CREATE INDEX "HotelStay_roomTypeId_idx" ON "HotelStay"("roomTypeId");

-- CreateIndex
CREATE INDEX "HotelFolioLine_stayId_idx" ON "HotelFolioLine"("stayId");

-- AddForeignKey
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "HotelRoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelFolioLine" ADD CONSTRAINT "HotelFolioLine_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "HotelStay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
