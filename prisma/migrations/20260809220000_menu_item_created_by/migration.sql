-- Produits F&B : auteur (user membre de la branche)
ALTER TABLE "HotelMenuItem" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;
CREATE INDEX IF NOT EXISTS "HotelMenuItem_branchId_createdByUserId_idx"
  ON "HotelMenuItem"("branchId", "createdByUserId");
