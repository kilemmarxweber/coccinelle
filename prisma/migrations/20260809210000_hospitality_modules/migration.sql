-- Hospitalité : type RESTAURANT + modules hasStays / hasRestaurant
-- Backfill : branches HOTEL existantes = les deux modules actifs

ALTER TYPE "BranchType" ADD VALUE IF NOT EXISTS 'RESTAURANT';

ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "hasStays" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "hasRestaurant" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Branch"
SET "hasStays" = true, "hasRestaurant" = true
WHERE type = 'HOTEL';
