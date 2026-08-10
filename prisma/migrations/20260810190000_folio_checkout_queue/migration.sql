-- AlterTable
ALTER TABLE "Folio" ADD COLUMN IF NOT EXISTS "checkoutQueuedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Folio_branchId_checkoutQueuedAt_idx" ON "Folio"("branchId", "checkoutQueuedAt");
