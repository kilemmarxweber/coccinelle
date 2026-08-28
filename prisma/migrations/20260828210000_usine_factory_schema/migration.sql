-- Usine / factory : colonnes Branch + enums + tables
-- (features appliquées en local via db push, absentes des migrations précédentes)

-- BranchType: USINE
ALTER TYPE "BranchType" ADD VALUE IF NOT EXISTS 'USINE';

-- Branch flags eau / vins
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "hasEau" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Branch" ADD COLUMN IF NOT EXISTS "hasVin" BOOLEAN NOT NULL DEFAULT false;

-- Factory enums
DO $$ BEGIN
  CREATE TYPE "FactoryProductKind" AS ENUM ('FINISHED', 'CONSUMABLE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FactoryFinishedFamily" AS ENUM ('EAU', 'VIN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FactoryCreditStatus" AS ENUM ('OPEN', 'PARTIAL', 'SETTLED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FactoryInstallmentKind" AS ENUM ('ACOMPTE', 'COMPLEMENT', 'SOLDE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FactoryReservationStatus" AS ENUM ('HOLD', 'PICKED', 'EXPIRED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FactoryBatchStatus" AS ENUM ('DRAFT', 'VALIDATED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ShopProduct usine
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "productKind" "FactoryProductKind" NOT NULL DEFAULT 'FINISHED';
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "finishedFamily" "FactoryFinishedFamily";

-- Fournisseurs branche
CREATE TABLE IF NOT EXISTS "BranchSupplier" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "contactName" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BranchSupplier_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BranchSupplier_branchId_active_idx" ON "BranchSupplier"("branchId", "active");

DO $$ BEGIN
  ALTER TABLE "BranchSupplier" ADD CONSTRAINT "BranchSupplier_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- PurchaseOrder → fournisseur enregistré
ALTER TABLE "PurchaseOrder" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

CREATE INDEX IF NOT EXISTS "PurchaseOrder_supplierId_idx" ON "PurchaseOrder"("supplierId");

DO $$ BEGIN
  ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_supplierId_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "BranchSupplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Clients usine
CREATE TABLE IF NOT EXISTS "FactoryCustomer" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "contactName" TEXT,
    "companyName" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FactoryCustomer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FactoryCustomer_branchId_active_idx" ON "FactoryCustomer"("branchId", "active");
CREATE INDEX IF NOT EXISTS "FactoryCustomer_branchId_phone_idx" ON "FactoryCustomer"("branchId", "phone");

DO $$ BEGIN
  ALTER TABLE "FactoryCustomer" ADD CONSTRAINT "FactoryCustomer_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Crédits usine
CREATE TABLE IF NOT EXISTS "FactoryCredit" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "marketerUserId" TEXT NOT NULL,
    "marketerDisplayName" TEXT NOT NULL,
    "status" "FactoryCreditStatus" NOT NULL DEFAULT 'OPEN',
    "dueAt" DATE NOT NULL,
    "originalDueAt" DATE NOT NULL,
    "totalUsd" DOUBLE PRECISION NOT NULL,
    "paidUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fxUsdToCdf" DOUBLE PRECISION,
    "documentIssuedAt" TIMESTAMP(3),
    "signedAt" TIMESTAMP(3),
    "reminderSentAt" TIMESTAMP(3),
    "dueDayReminderSentAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FactoryCredit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FactoryCredit_branchId_number_key" ON "FactoryCredit"("branchId", "number");
CREATE INDEX IF NOT EXISTS "FactoryCredit_branchId_status_idx" ON "FactoryCredit"("branchId", "status");
CREATE INDEX IF NOT EXISTS "FactoryCredit_customerId_idx" ON "FactoryCredit"("customerId");
CREATE INDEX IF NOT EXISTS "FactoryCredit_branchId_dueAt_idx" ON "FactoryCredit"("branchId", "dueAt");

DO $$ BEGIN
  ALTER TABLE "FactoryCredit" ADD CONSTRAINT "FactoryCredit_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryCredit" ADD CONSTRAINT "FactoryCredit_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "FactoryCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FactoryCreditLine" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "shopProductId" TEXT NOT NULL,
    "nameSnapshot" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceUsd" DOUBLE PRECISION NOT NULL,
    "lineTotalUsd" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "FactoryCreditLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FactoryCreditLine_creditId_idx" ON "FactoryCreditLine"("creditId");

DO $$ BEGIN
  ALTER TABLE "FactoryCreditLine" ADD CONSTRAINT "FactoryCreditLine_creditId_fkey"
    FOREIGN KEY ("creditId") REFERENCES "FactoryCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryCreditLine" ADD CONSTRAINT "FactoryCreditLine_shopProductId_fkey"
    FOREIGN KEY ("shopProductId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FactoryCreditExtension" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "previousDueAt" DATE NOT NULL,
    "newDueAt" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FactoryCreditExtension_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FactoryCreditExtension_creditId_idx" ON "FactoryCreditExtension"("creditId");

DO $$ BEGIN
  ALTER TABLE "FactoryCreditExtension" ADD CONSTRAINT "FactoryCreditExtension_creditId_fkey"
    FOREIGN KEY ("creditId") REFERENCES "FactoryCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Recettes / lots
CREATE TABLE IF NOT EXISTS "FactoryRecipe" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "shopProductId" TEXT NOT NULL,
    "outputQty" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FactoryRecipe_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FactoryRecipe_branchId_active_idx" ON "FactoryRecipe"("branchId", "active");
CREATE INDEX IF NOT EXISTS "FactoryRecipe_shopProductId_idx" ON "FactoryRecipe"("shopProductId");

DO $$ BEGIN
  ALTER TABLE "FactoryRecipe" ADD CONSTRAINT "FactoryRecipe_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryRecipe" ADD CONSTRAINT "FactoryRecipe_shopProductId_fkey"
    FOREIGN KEY ("shopProductId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FactoryRecipeLine" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "consumableProductId" TEXT NOT NULL,
    "qtyPerBatch" DOUBLE PRECISION NOT NULL,
    CONSTRAINT "FactoryRecipeLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FactoryRecipeLine_recipeId_idx" ON "FactoryRecipeLine"("recipeId");

DO $$ BEGIN
  ALTER TABLE "FactoryRecipeLine" ADD CONSTRAINT "FactoryRecipeLine_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "FactoryRecipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryRecipeLine" ADD CONSTRAINT "FactoryRecipeLine_consumableProductId_fkey"
    FOREIGN KEY ("consumableProductId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FactoryBatch" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" "FactoryBatchStatus" NOT NULL DEFAULT 'DRAFT',
    "recipeId" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "outputProductId" TEXT NOT NULL,
    "outputQty" INTEGER NOT NULL,
    "notes" TEXT,
    "producedAt" TIMESTAMP(3),
    "validatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FactoryBatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FactoryBatch_branchId_number_key" ON "FactoryBatch"("branchId", "number");
CREATE INDEX IF NOT EXISTS "FactoryBatch_branchId_status_idx" ON "FactoryBatch"("branchId", "status");

DO $$ BEGIN
  ALTER TABLE "FactoryBatch" ADD CONSTRAINT "FactoryBatch_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryBatch" ADD CONSTRAINT "FactoryBatch_recipeId_fkey"
    FOREIGN KEY ("recipeId") REFERENCES "FactoryRecipe"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryBatch" ADD CONSTRAINT "FactoryBatch_outputProductId_fkey"
    FOREIGN KEY ("outputProductId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Réservations float
CREATE TABLE IF NOT EXISTS "FactoryReservation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "marketerUserId" TEXT NOT NULL,
    "marketerDisplayName" TEXT NOT NULL,
    "status" "FactoryReservationStatus" NOT NULL DEFAULT 'HOLD',
    "holdUntil" TIMESTAMP(3) NOT NULL,
    "creditId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FactoryReservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FactoryReservation_branchId_status_idx" ON "FactoryReservation"("branchId", "status");
CREATE INDEX IF NOT EXISTS "FactoryReservation_customerId_idx" ON "FactoryReservation"("customerId");
CREATE INDEX IF NOT EXISTS "FactoryReservation_holdUntil_idx" ON "FactoryReservation"("holdUntil");

DO $$ BEGIN
  ALTER TABLE "FactoryReservation" ADD CONSTRAINT "FactoryReservation_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryReservation" ADD CONSTRAINT "FactoryReservation_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "FactoryCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryReservation" ADD CONSTRAINT "FactoryReservation_creditId_fkey"
    FOREIGN KEY ("creditId") REFERENCES "FactoryCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FactoryReservationLine" (
    "id" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "shopProductId" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    CONSTRAINT "FactoryReservationLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FactoryReservationLine_reservationId_idx" ON "FactoryReservationLine"("reservationId");

DO $$ BEGIN
  ALTER TABLE "FactoryReservationLine" ADD CONSTRAINT "FactoryReservationLine_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "FactoryReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryReservationLine" ADD CONSTRAINT "FactoryReservationLine_shopProductId_fkey"
    FOREIGN KEY ("shopProductId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Payment ↔ crédit usine
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "factoryCreditId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "installmentKind" "FactoryInstallmentKind";

CREATE INDEX IF NOT EXISTS "Payment_factoryCreditId_idx" ON "Payment"("factoryCreditId");

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_factoryCreditId_fkey"
    FOREIGN KEY ("factoryCreditId") REFERENCES "FactoryCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
