-- Boutique dual-stock: warehouse (principal) + ShopProduct (auxiliaire)

CREATE TYPE "WarehouseProductType" AS ENUM ('BOUTIQUE', 'DIVERS');

CREATE TYPE "WarehouseMovementKind" AS ENUM ('ENTREE', 'SORTIE', 'AJUSTEMENT', 'TRANSFERT');

CREATE TYPE "WarehouseSlipKind" AS ENUM ('COMMANDE', 'SORTIE');

CREATE TYPE "WarehouseSlipStatus" AS ENUM ('BROUILLON', 'ENVOYE', 'VALIDE', 'RECU', 'ANNULE');

CREATE TYPE "WarehouseDestination" AS ENUM ('BOUTIQUE', 'FOURNISSEUR');

CREATE TYPE "WarehouseLocationZone" AS ENUM ('STOCK', 'BOUTIQUE');

CREATE TABLE "WarehouseCategory" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productType" "WarehouseProductType" NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseLocation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "zone" "WarehouseLocationZone" NOT NULL DEFAULT 'STOCK',
    "floor" TEXT NOT NULL DEFAULT 'RDC',
    "code" TEXT NOT NULL,
    "label" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseLocation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseProduct" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WarehouseProductType" NOT NULL DEFAULT 'BOUTIQUE',
    "categoryId" TEXT,
    "locationId" TEXT,
    "destLocationId" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "minQty" INTEGER NOT NULL DEFAULT 5,
    "unitCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shopProductId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseProduct_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseSlip" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "kind" "WarehouseSlipKind" NOT NULL,
    "status" "WarehouseSlipStatus" NOT NULL DEFAULT 'BROUILLON',
    "destination" "WarehouseDestination",
    "supplierName" TEXT,
    "note" TEXT,
    "managerUserId" TEXT NOT NULL,
    "recipientUserId" TEXT,
    "validatedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "receivedByUserId" TEXT,
    "recipientSignature" TEXT,
    "receiveNote" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarehouseSlip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseSlipItem" (
    "id" TEXT NOT NULL,
    "slipId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "productType" "WarehouseProductType" NOT NULL DEFAULT 'BOUTIQUE',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createProduct" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseSlipItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WarehouseMovement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "kind" "WarehouseMovementKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockBefore" INTEGER NOT NULL,
    "stockAfter" INTEGER NOT NULL,
    "note" TEXT,
    "slipId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WarehouseMovement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WarehouseCategory_branchId_productType_name_key" ON "WarehouseCategory"("branchId", "productType", "name");
CREATE INDEX "WarehouseCategory_branchId_productType_active_idx" ON "WarehouseCategory"("branchId", "productType", "active");

CREATE UNIQUE INDEX "WarehouseLocation_branchId_zone_floor_code_key" ON "WarehouseLocation"("branchId", "zone", "floor", "code");
CREATE INDEX "WarehouseLocation_branchId_zone_floor_idx" ON "WarehouseLocation"("branchId", "zone", "floor");

CREATE UNIQUE INDEX "WarehouseProduct_branchId_sku_key" ON "WarehouseProduct"("branchId", "sku");
CREATE INDEX "WarehouseProduct_branchId_type_active_idx" ON "WarehouseProduct"("branchId", "type", "active");
CREATE INDEX "WarehouseProduct_branchId_stockQty_idx" ON "WarehouseProduct"("branchId", "stockQty");
CREATE INDEX "WarehouseProduct_categoryId_idx" ON "WarehouseProduct"("categoryId");
CREATE INDEX "WarehouseProduct_locationId_idx" ON "WarehouseProduct"("locationId");
CREATE INDEX "WarehouseProduct_destLocationId_idx" ON "WarehouseProduct"("destLocationId");
CREATE INDEX "WarehouseProduct_shopProductId_idx" ON "WarehouseProduct"("shopProductId");

CREATE UNIQUE INDEX "WarehouseSlip_branchId_number_key" ON "WarehouseSlip"("branchId", "number");
CREATE INDEX "WarehouseSlip_branchId_kind_status_idx" ON "WarehouseSlip"("branchId", "kind", "status");
CREATE INDEX "WarehouseSlip_branchId_destination_status_idx" ON "WarehouseSlip"("branchId", "destination", "status");
CREATE INDEX "WarehouseSlip_branchId_createdAt_idx" ON "WarehouseSlip"("branchId", "createdAt");

CREATE INDEX "WarehouseSlipItem_slipId_idx" ON "WarehouseSlipItem"("slipId");
CREATE INDEX "WarehouseSlipItem_productId_idx" ON "WarehouseSlipItem"("productId");

CREATE INDEX "WarehouseMovement_branchId_createdAt_idx" ON "WarehouseMovement"("branchId", "createdAt");
CREATE INDEX "WarehouseMovement_productId_createdAt_idx" ON "WarehouseMovement"("productId", "createdAt");
CREATE INDEX "WarehouseMovement_slipId_idx" ON "WarehouseMovement"("slipId");

ALTER TABLE "WarehouseCategory" ADD CONSTRAINT "WarehouseCategory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarehouseLocation" ADD CONSTRAINT "WarehouseLocation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarehouseProduct" ADD CONSTRAINT "WarehouseProduct_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseProduct" ADD CONSTRAINT "WarehouseProduct_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "WarehouseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarehouseProduct" ADD CONSTRAINT "WarehouseProduct_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WarehouseProduct" ADD CONSTRAINT "WarehouseProduct_destLocationId_fkey" FOREIGN KEY ("destLocationId") REFERENCES "WarehouseLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WarehouseSlip" ADD CONSTRAINT "WarehouseSlip_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WarehouseSlipItem" ADD CONSTRAINT "WarehouseSlipItem_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "WarehouseSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseSlipItem" ADD CONSTRAINT "WarehouseSlipItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "WarehouseProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WarehouseMovement" ADD CONSTRAINT "WarehouseMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WarehouseMovement" ADD CONSTRAINT "WarehouseMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "WarehouseProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WarehouseMovement" ADD CONSTRAINT "WarehouseMovement_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "WarehouseSlip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
