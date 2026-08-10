-- AlterTable
ALTER TABLE "HotelOrder" ADD COLUMN IF NOT EXISTS "settlementMode" TEXT NOT NULL DEFAULT 'COMPTANT';
ALTER TABLE "HotelOrder" ADD COLUMN IF NOT EXISTS "postedToFolioAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HotelOrder_branchId_settlementMode_idx" ON "HotelOrder"("branchId", "settlementMode");
