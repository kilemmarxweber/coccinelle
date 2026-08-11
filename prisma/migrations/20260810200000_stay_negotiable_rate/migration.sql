-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "StayBillingMode" AS ENUM ('NIGHTLY', 'FLAT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterEnum FolioLineKind
ALTER TYPE "FolioLineKind" ADD VALUE IF NOT EXISTS 'STAY_FLAT';

-- AlterTable HotelStay
ALTER TABLE "HotelStay" ADD COLUMN IF NOT EXISTS "billingMode" "StayBillingMode" NOT NULL DEFAULT 'NIGHTLY';
ALTER TABLE "HotelStay" ADD COLUMN IF NOT EXISTS "catalogUnitPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "HotelStay" ADD COLUMN IF NOT EXISTS "unitPriceApplied" DOUBLE PRECISION;
ALTER TABLE "HotelStay" ADD COLUMN IF NOT EXISTS "flatAmount" DOUBLE PRECISION;
ALTER TABLE "HotelStay" ADD COLUMN IF NOT EXISTS "plannedHours" INTEGER;
ALTER TABLE "HotelStay" ADD COLUMN IF NOT EXISTS "rateNote" TEXT;
ALTER TABLE "HotelStay" ADD COLUMN IF NOT EXISTS "negotiatedByUserId" TEXT;

-- Backfill catalogue depuis le type de chambre
UPDATE "HotelStay" s
SET "catalogUnitPrice" = rt."priceNight"
FROM "HotelRoom" r
JOIN "HotelRoomType" rt ON rt.id = r."roomTypeId"
WHERE s."roomId" = r.id
  AND (s."catalogUnitPrice" = 0 OR s."catalogUnitPrice" IS NULL);
