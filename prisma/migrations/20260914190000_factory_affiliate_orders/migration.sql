-- Affiliation crédit usine : clients étendus + demandes de commande

DO $$ BEGIN
  CREATE TYPE "FactoryOrderRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "FactoryCustomer"
  ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryCity" TEXT,
  ADD COLUMN IF NOT EXISTS "affiliateBranchId" TEXT,
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "notifyPrefs" JSONB;

DO $$ BEGIN
  ALTER TABLE "FactoryCustomer"
    ADD CONSTRAINT "FactoryCustomer_userId_key" UNIQUE ("userId");
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryCustomer"
    ADD CONSTRAINT "FactoryCustomer_affiliateBranchId_fkey"
    FOREIGN KEY ("affiliateBranchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryCustomer"
    ADD CONSTRAINT "FactoryCustomer_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "FactoryCustomer_affiliateBranchId_idx" ON "FactoryCustomer"("affiliateBranchId");

ALTER TABLE "FactoryCredit"
  ADD COLUMN IF NOT EXISTS "deliveryAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryCity" TEXT,
  ADD COLUMN IF NOT EXISTS "requestedDeliveryAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "FactoryOrderRequest" (
  "id" TEXT NOT NULL,
  "branchId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "status" "FactoryOrderRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedDeliveryAt" TIMESTAMP(3),
  "deliveryAddress" TEXT,
  "deliveryCity" TEXT,
  "notes" TEXT,
  "reviewedByUserId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "rejectReason" TEXT,
  "creditId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FactoryOrderRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FactoryOrderRequest_creditId_key" ON "FactoryOrderRequest"("creditId");
CREATE INDEX IF NOT EXISTS "FactoryOrderRequest_branchId_status_idx" ON "FactoryOrderRequest"("branchId", "status");
CREATE INDEX IF NOT EXISTS "FactoryOrderRequest_customerId_idx" ON "FactoryOrderRequest"("customerId");
CREATE INDEX IF NOT EXISTS "FactoryOrderRequest_branchId_createdAt_idx" ON "FactoryOrderRequest"("branchId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "FactoryOrderRequest"
    ADD CONSTRAINT "FactoryOrderRequest_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryOrderRequest"
    ADD CONSTRAINT "FactoryOrderRequest_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "FactoryCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryOrderRequest"
    ADD CONSTRAINT "FactoryOrderRequest_creditId_fkey"
    FOREIGN KEY ("creditId") REFERENCES "FactoryCredit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "FactoryOrderRequestLine" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "shopProductId" TEXT NOT NULL,
  "nameSnapshot" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "unitPriceUsd" DOUBLE PRECISION,
  CONSTRAINT "FactoryOrderRequestLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FactoryOrderRequestLine_requestId_idx" ON "FactoryOrderRequestLine"("requestId");

DO $$ BEGIN
  ALTER TABLE "FactoryOrderRequestLine"
    ADD CONSTRAINT "FactoryOrderRequestLine_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "FactoryOrderRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "FactoryOrderRequestLine"
    ADD CONSTRAINT "FactoryOrderRequestLine_shopProductId_fkey"
    FOREIGN KEY ("shopProductId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
