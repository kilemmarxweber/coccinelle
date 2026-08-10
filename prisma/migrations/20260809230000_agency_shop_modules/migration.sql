-- Agence : modes Avion / Bus / Bateau
-- Boutique : verticales Pharmacie / Boutique / Alimentation
-- ModeTransport : BATEAU

ALTER TYPE "ModeTransport" ADD VALUE IF NOT EXISTS 'BATEAU';

ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "hasAvion" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "hasBus" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "hasBateau" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "hasPharmacie" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "hasShop" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "hasAlimentation" BOOLEAN NOT NULL DEFAULT false;

-- Backfill : agences existantes = Avion + Bus (historique seed)
UPDATE "Branch"
SET "hasAvion" = true, "hasBus" = true
WHERE type = 'AGENCE';

-- Backfill : boutiques existantes = verticale Boutique
UPDATE "Branch"
SET "hasShop" = true
WHERE type = 'BOUTIQUE';
