-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('EN_ATTENTE', 'FONDS_SORTIS', 'VALIDE', 'ANNULE');

-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "expenseId" TEXT;

-- CreateTable
CREATE TABLE "PurchaseOrder" (
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

CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
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

CREATE TABLE "BranchExpense" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Divers',
    "amountUsd" DOUBLE PRECISION NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchExpense_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseOrder_branchId_number_key" ON "PurchaseOrder"("branchId", "number");
CREATE INDEX "PurchaseOrder_branchId_status_idx" ON "PurchaseOrder"("branchId", "status");
CREATE INDEX "PurchaseOrder_branchId_createdAt_idx" ON "PurchaseOrder"("branchId", "createdAt");
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");
CREATE INDEX "BranchExpense_branchId_createdAt_idx" ON "BranchExpense"("branchId", "createdAt");

CREATE UNIQUE INDEX "Payment_expenseId_key" ON "Payment"("expenseId");
CREATE INDEX "Payment_purchaseOrderId_idx" ON "Payment"("purchaseOrderId");

ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BranchExpense" ADD CONSTRAINT "BranchExpense_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "BranchExpense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
