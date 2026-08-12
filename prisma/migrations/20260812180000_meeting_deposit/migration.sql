-- Caution consommation salles (réunion / fête)
ALTER TYPE "FolioLineKind" ADD VALUE IF NOT EXISTS 'DEPOSIT';

ALTER TABLE "HotelStay"
  ADD COLUMN IF NOT EXISTS "depositAmountExpected" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "depositCollectedAt" TIMESTAMP(3);
