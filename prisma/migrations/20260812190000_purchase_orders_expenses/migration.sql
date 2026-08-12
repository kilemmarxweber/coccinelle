-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PurchaseOrderStatus" AS ENUM ('EN_ATTENTE', 'FONDS_SORTIS', 'VALIDE', 'ANNULE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "expenseId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'EN_ATTENTE',
    "supplierName" TEXT,
    "note" TEXT,
    "totalAmountUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fundsReleasedUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validatedAmountUsd" DOUBLE PRECISION,
    "createdByUserId" TEXT NOT NULL,
    "validatedByUserId" TEXT,
    "validatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Divers',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "receivedQty" INTEGER,
    "unitPriceUsd" DOUBLE PRECISION NOT NULL,
    "lineTotalUsd" DOUBLE PRECISION NOT NULL,
    "shopProductId" TEXT,
    "menuItemId" TEXT,
    "createProduct" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BranchExpense" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DEPENSE',
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Divers',
    "beneficiary" TEXT,
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchExpense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_branchId_number_key" ON "PurchaseOrder"("branchId", "number");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_branchId_status_idx" ON "PurchaseOrder"("branchId", "status");
CREATE INDEX IF NOT EXISTS "PurchaseOrder_branchId_createdAt_idx" ON "PurchaseOrder"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");
CREATE UNIQUE INDEX IF NOT EXISTS "BranchExpense_branchId_number_key" ON "BranchExpense"("branchId", "number");
CREATE INDEX IF NOT EXISTS "BranchExpense_branchId_createdAt_idx" ON "BranchExpense"("branchId", "createdAt");
CREATE INDEX IF NOT EXISTS "BranchExpense_branchId_kind_idx" ON "BranchExpense"("branchId", "kind");

CREATE UNIQUE INDEX IF NOT EXISTS "Payment_expenseId_key" ON "Payment"("expenseId");
CREATE INDEX IF NOT EXISTS "Payment_purchaseOrderId_idx" ON "Payment"("purchaseOrderId");

DO $$ BEGIN
  ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "BranchExpense" ADD CONSTRAINT "BranchExpense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "BranchExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
