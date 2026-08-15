-- Align schema drift after migrate reset (fields added in Prisma but never migrated).

-- Branch : logo + email (createBranchWithBootstrapAction)
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

-- Dépenses : n° document, type, bénéficiaire
ALTER TABLE "BranchExpense" ADD COLUMN IF NOT EXISTS "beneficiary" TEXT;
ALTER TABLE "BranchExpense" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'DEPENSE';
ALTER TABLE "BranchExpense" ADD COLUMN IF NOT EXISTS "number" TEXT;

UPDATE "BranchExpense" e
SET "number" = 'DEP-' || LPAD(s.rn::text, 5, '0')
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY "branchId" ORDER BY "createdAt") AS rn
  FROM "BranchExpense"
  WHERE "number" IS NULL OR "number" = ''
) s
WHERE e.id = s.id;

ALTER TABLE "BranchExpense" ALTER COLUMN "number" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "BranchExpense_branchId_kind_idx" ON "BranchExpense"("branchId", "kind");
CREATE UNIQUE INDEX IF NOT EXISTS "BranchExpense_branchId_number_key" ON "BranchExpense"("branchId", "number");

-- Achats : catégorie ligne
ALTER TABLE "PurchaseOrderItem" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'Divers';

-- Dossier groupe : booker particulier + facture ; partenaire optionnel
ALTER TABLE "PartnerBooking" DROP CONSTRAINT IF EXISTS "PartnerBooking_partnerId_fkey";
ALTER TABLE "PartnerBooking" ADD COLUMN IF NOT EXISTS "bookerEmail" TEXT;
ALTER TABLE "PartnerBooking" ADD COLUMN IF NOT EXISTS "bookerName" TEXT;
ALTER TABLE "PartnerBooking" ADD COLUMN IF NOT EXISTS "bookerPhone" TEXT;
ALTER TABLE "PartnerBooking" ADD COLUMN IF NOT EXISTS "invoiceHandedOverAt" TIMESTAMP(3);
ALTER TABLE "PartnerBooking" ADD COLUMN IF NOT EXISTS "invoiceIssuedAt" TIMESTAMP(3);
ALTER TABLE "PartnerBooking" ADD COLUMN IF NOT EXISTS "invoiceIssuedByUserId" TEXT;
ALTER TABLE "PartnerBooking" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT;
ALTER TABLE "PartnerBooking" ALTER COLUMN "partnerId" DROP NOT NULL;
ALTER TABLE "PartnerBooking" ADD CONSTRAINT "PartnerBooking_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "BranchPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Pièce d'identité : uniquement sur le séjour (HotelStay), plus sur BranchPartner
DROP INDEX IF EXISTS "BranchPartner_branchId_idDocumentNumber_idx";
ALTER TABLE "BranchPartner" DROP COLUMN IF EXISTS "idDocumentCapturedAt";
ALTER TABLE "BranchPartner" DROP COLUMN IF EXISTS "idDocumentImageUrl";
ALTER TABLE "BranchPartner" DROP COLUMN IF EXISTS "idDocumentNumber";
ALTER TABLE "BranchPartner" DROP COLUMN IF EXISTS "idDocumentType";
DROP TYPE IF EXISTS "PartnerIdDocumentType";

CREATE INDEX IF NOT EXISTS "ShopStockMovement_saleId_idx" ON "ShopStockMovement"("saleId");

-- Nom d'index PG tronqué à 63 car. → nom Prisma
ALTER INDEX IF EXISTS "ServiceStockSession_branchId_closeDisposition_handoverClaimedBy"
  RENAME TO "ServiceStockSession_branchId_closeDisposition_handoverClaim_idx";
