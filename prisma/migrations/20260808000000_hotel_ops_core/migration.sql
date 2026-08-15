-- Tables hôtel / caisse / F&B / boutique POS jamais versionnées (db push).
-- Doit s’appliquer avant 20260808191500_hotel_order_prep_estimate.

-- Enums
CREATE TYPE "ShopProductKind" AS ENUM ('ARTICLE', 'PLAT');
CREATE TYPE "ShopSaleStatus" AS ENUM ('BROUILLON', 'EN_ATTENTE', 'ENCAISSEE', 'ANNULEE');
CREATE TYPE "ShopStockMovementKind" AS ENUM ('ENTREE', 'SORTIE', 'AJUSTEMENT');
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED');
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'MOBILE_MONEY', 'CARTE');
CREATE TYPE "IdDocumentType" AS ENUM ('CNI', 'PASSPORT', 'PERMIS', 'AUTRE');
CREATE TYPE "HotelStayStatus" AS ENUM ('RESERVED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW');
CREATE TYPE "FolioLineKind" AS ENUM ('NIGHT', 'FNB', 'PRODUCT', 'TAX', 'OTHER');
CREATE TYPE "HotelOrderStatus" AS ENUM ('BROUILLON', 'ENVOYEE', 'EN_PREPARATION', 'PRETE', 'EN_CAISSE', 'PAYEE', 'LIVREE', 'ANNULEE');

-- Boutique : colonnes ajoutées hors migration
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "kind" "ShopProductKind" NOT NULL DEFAULT 'ARTICLE';
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "promoPrice" DOUBLE PRECISION;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "promoActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "promoLabel" TEXT;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "promoStartsAt" TIMESTAMP(3);
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "promoEndsAt" TIMESTAMP(3);
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "barcode" TEXT;
ALTER TABLE "ShopProduct" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;

UPDATE "ShopProduct" p
SET "branchId" = c."branchId"
FROM "ShopCategory" c
WHERE p."categoryId" = c.id
  AND (p."branchId" IS NULL OR p."branchId" = '');

DO $$ BEGIN
  ALTER TABLE "ShopProduct" ALTER COLUMN "branchId" SET NOT NULL;
EXCEPTION
  WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "ShopProduct_branchId_active_idx" ON "ShopProduct"("branchId", "active");
CREATE INDEX IF NOT EXISTS "ShopProduct_branchId_kind_idx" ON "ShopProduct"("branchId", "kind");
CREATE UNIQUE INDEX IF NOT EXISTS "ShopProduct_branchId_barcode_key" ON "ShopProduct"("branchId", "barcode");

CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fromCurrency" TEXT NOT NULL DEFAULT 'USD',
    "toCurrency" TEXT NOT NULL DEFAULT 'CDF',
    "rate" DOUBLE PRECISION NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "closedByUserId" TEXT,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openingFloat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closingCash" DOUBLE PRECISION,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HotelStay" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestPhone" TEXT,
    "guestEmail" TEXT,
    "guestAddress" TEXT,
    "guestCity" TEXT,
    "idDocumentType" "IdDocumentType",
    "idDocumentNumber" TEXT,
    "idDocumentImageUrl" TEXT,
    "idDocumentCapturedAt" TIMESTAMP(3),
    "guestPending" BOOLEAN NOT NULL DEFAULT false,
    "checkInDate" DATE NOT NULL,
    "checkOutDate" DATE NOT NULL,
    "status" "HotelStayStatus" NOT NULL DEFAULT 'RESERVED',
    "adults" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "checkedInAt" TIMESTAMP(3),
    "checkedOutAt" TIMESTAMP(3),
    "checkoutReminderSentAt" TIMESTAMP(3),
    "checkoutThanksSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HotelStay_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Folio" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stayId" TEXT,
    "label" TEXT,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Folio_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FolioLine" (
    "id" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "kind" "FolioLineKind" NOT NULL DEFAULT 'OTHER',
    "description" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FolioLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HotelMenuItem" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Divers',
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "stockQty" INTEGER NOT NULL DEFAULT 50,
    "isConsumable" BOOLEAN NOT NULL DEFAULT false,
    "provenance" TEXT,
    "supplierName" TEXT,
    "needsKitchen" BOOLEAN NOT NULL DEFAULT true,
    "storageZone" TEXT NOT NULL DEFAULT 'MAGASIN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HotelMenuItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HotelOrder" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stayId" TEXT,
    "folioId" TEXT,
    "tableLabel" TEXT,
    "status" "HotelOrderStatus" NOT NULL DEFAULT 'BROUILLON',
    "serverNote" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "preparedByUserId" TEXT,
    "readyAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    CONSTRAINT "HotelOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HotelOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "needsKitchen" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "HotelOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopSale" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "status" "ShopSaleStatus" NOT NULL DEFAULT 'BROUILLON',
    "ticketNumber" TEXT NOT NULL,
    "holdLabel" TEXT,
    "clientLabel" TEXT,
    "clientPhone" TEXT,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT true,
    "anonymousCode" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cashierUserId" TEXT,
    "heldAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopSale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopSaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "kind" "ShopProductKind" NOT NULL DEFAULT 'ARTICLE',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "catalogPrice" DOUBLE PRECISION,
    "wasPromo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopSaleItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ShopStockMovement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "saleId" TEXT,
    "kind" "ShopStockMovementKind" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "cashSessionId" TEXT,
    "folioId" TEXT,
    "orderId" TEXT,
    "shopSaleId" TEXT,
    "receiptNumber" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "amountCdf" DOUBLE PRECISION NOT NULL,
    "amountForeign" DOUBLE PRECISION,
    "foreignCurrency" TEXT,
    "exchangeRateUsed" DOUBLE PRECISION,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cashierUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HotelStockMovement" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stockBefore" INTEGER NOT NULL DEFAULT 0,
    "stockAfter" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HotelStockMovement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceStockSession" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "vendorUserId" TEXT NOT NULL,
    "vendorDisplayName" TEXT NOT NULL,
    "openedByUserId" TEXT NOT NULL,
    "closedByManagerUserId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingConfirmedAt" TIMESTAMP(3),
    "openingDocumentPrintedAt" TIMESTAMP(3),
    "closingDocumentPrintedAt" TIMESTAMP(3),
    "closeDisposition" TEXT,
    "inheritedFromSessionId" TEXT,
    "handoverClaimedBySessionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceStockSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceStockLine" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "qtyAttributed" INTEGER NOT NULL DEFAULT 0,
    "qtyOpeningCounted" INTEGER,
    "qtySold" INTEGER NOT NULL DEFAULT 0,
    "qtyClosingCounted" INTEGER,
    "qtyReturnedToDepot" INTEGER NOT NULL DEFAULT 0,
    "qtyLoss" INTEGER NOT NULL DEFAULT 0,
    "unitPriceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sourceZone" TEXT NOT NULL DEFAULT 'MAGASIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServiceStockLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ServiceStockTopUp" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sourceZone" TEXT NOT NULL DEFAULT 'MAGASIN',
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ServiceStockTopUp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BranchNotification" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'info',
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BranchNotification_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "ExchangeRate_branchId_validFrom_idx" ON "ExchangeRate"("branchId", "validFrom");
CREATE INDEX "CashSession_branchId_status_idx" ON "CashSession"("branchId", "status");
CREATE INDEX "HotelStay_branchId_checkInDate_checkOutDate_idx" ON "HotelStay"("branchId", "checkInDate", "checkOutDate");
CREATE INDEX "HotelStay_roomId_status_idx" ON "HotelStay"("roomId", "status");
CREATE UNIQUE INDEX "Folio_stayId_key" ON "Folio"("stayId");
CREATE INDEX "Folio_branchId_closed_idx" ON "Folio"("branchId", "closed");
CREATE INDEX "FolioLine_folioId_idx" ON "FolioLine"("folioId");
CREATE INDEX "HotelMenuItem_branchId_active_idx" ON "HotelMenuItem"("branchId", "active");
CREATE INDEX "HotelMenuItem_branchId_isConsumable_idx" ON "HotelMenuItem"("branchId", "isConsumable");
CREATE INDEX "HotelMenuItem_branchId_storageZone_idx" ON "HotelMenuItem"("branchId", "storageZone");
CREATE INDEX "HotelOrder_branchId_status_idx" ON "HotelOrder"("branchId", "status");
CREATE INDEX "HotelOrderItem_orderId_idx" ON "HotelOrderItem"("orderId");
CREATE UNIQUE INDEX "ShopSale_branchId_ticketNumber_key" ON "ShopSale"("branchId", "ticketNumber");
CREATE INDEX "ShopSale_branchId_status_idx" ON "ShopSale"("branchId", "status");
CREATE INDEX "ShopSale_branchId_createdAt_idx" ON "ShopSale"("branchId", "createdAt");
CREATE INDEX "ShopSaleItem_saleId_idx" ON "ShopSaleItem"("saleId");
CREATE INDEX "ShopSaleItem_productId_idx" ON "ShopSaleItem"("productId");
CREATE INDEX "ShopStockMovement_branchId_createdAt_idx" ON "ShopStockMovement"("branchId", "createdAt");
CREATE INDEX "ShopStockMovement_productId_idx" ON "ShopStockMovement"("productId");
CREATE UNIQUE INDEX "Payment_branchId_receiptNumber_key" ON "Payment"("branchId", "receiptNumber");
CREATE INDEX "Payment_branchId_paidAt_idx" ON "Payment"("branchId", "paidAt");
CREATE INDEX "Payment_folioId_idx" ON "Payment"("folioId");
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX "Payment_shopSaleId_idx" ON "Payment"("shopSaleId");
CREATE INDEX "HotelStockMovement_branchId_createdAt_idx" ON "HotelStockMovement"("branchId", "createdAt");
CREATE INDEX "HotelStockMovement_menuItemId_createdAt_idx" ON "HotelStockMovement"("menuItemId", "createdAt");
CREATE UNIQUE INDEX "ServiceStockSession_branchId_number_key" ON "ServiceStockSession"("branchId", "number");
CREATE INDEX "ServiceStockSession_branchId_status_idx" ON "ServiceStockSession"("branchId", "status");
CREATE INDEX "ServiceStockSession_branchId_openedAt_idx" ON "ServiceStockSession"("branchId", "openedAt");
CREATE INDEX "ServiceStockSession_branchId_closeDisposition_handoverClaimedBySessionId_idx" ON "ServiceStockSession"("branchId", "closeDisposition", "handoverClaimedBySessionId");
CREATE UNIQUE INDEX "ServiceStockLine_sessionId_menuItemId_key" ON "ServiceStockLine"("sessionId", "menuItemId");
CREATE INDEX "ServiceStockLine_menuItemId_idx" ON "ServiceStockLine"("menuItemId");
CREATE INDEX "ServiceStockTopUp_sessionId_createdAt_idx" ON "ServiceStockTopUp"("sessionId", "createdAt");
CREATE INDEX "ServiceStockTopUp_menuItemId_idx" ON "ServiceStockTopUp"("menuItemId");
CREATE INDEX "BranchNotification_branchId_createdAt_idx" ON "BranchNotification"("branchId", "createdAt");

-- Foreign keys
ALTER TABLE "ShopProduct" ADD CONSTRAINT "ShopProduct_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Folio" ADD CONSTRAINT "Folio_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "HotelStay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FolioLine" ADD CONSTRAINT "FolioLine_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelMenuItem" ADD CONSTRAINT "HotelMenuItem_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelOrder" ADD CONSTRAINT "HotelOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelOrder" ADD CONSTRAINT "HotelOrder_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "HotelStay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HotelOrder" ADD CONSTRAINT "HotelOrder_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HotelOrderItem" ADD CONSTRAINT "HotelOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "HotelOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelOrderItem" ADD CONSTRAINT "HotelOrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "HotelMenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopSale" ADD CONSTRAINT "ShopSale_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopSaleItem" ADD CONSTRAINT "ShopSaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "ShopSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopSaleItem" ADD CONSTRAINT "ShopSaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ShopStockMovement" ADD CONSTRAINT "ShopStockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopStockMovement" ADD CONSTRAINT "ShopStockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "ShopProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShopStockMovement" ADD CONSTRAINT "ShopStockMovement_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "ShopSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "HotelOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_shopSaleId_fkey" FOREIGN KEY ("shopSaleId") REFERENCES "ShopSale"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HotelStockMovement" ADD CONSTRAINT "HotelStockMovement_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelStockMovement" ADD CONSTRAINT "HotelStockMovement_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "HotelMenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceStockSession" ADD CONSTRAINT "ServiceStockSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceStockLine" ADD CONSTRAINT "ServiceStockLine_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ServiceStockSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceStockLine" ADD CONSTRAINT "ServiceStockLine_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "HotelMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceStockTopUp" ADD CONSTRAINT "ServiceStockTopUp_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ServiceStockSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ServiceStockTopUp" ADD CONSTRAINT "ServiceStockTopUp_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "HotelMenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BranchNotification" ADD CONSTRAINT "BranchNotification_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
