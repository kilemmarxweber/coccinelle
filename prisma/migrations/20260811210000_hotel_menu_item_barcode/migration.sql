-- Code-barres produit F&B (resto / vente rapide). NULL autorisé plusieurs fois (unicité PG).
ALTER TABLE "HotelMenuItem" ADD COLUMN IF NOT EXISTS "barcode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "HotelMenuItem_branchId_barcode_key"
  ON "HotelMenuItem"("branchId", "barcode");
