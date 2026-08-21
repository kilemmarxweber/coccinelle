-- AlterTable
ALTER TABLE "ServiceStockLine" ALTER COLUMN "menuItemId" DROP NOT NULL;
ALTER TABLE "ServiceStockLine" ADD COLUMN "shopProductId" TEXT;

-- AlterTable
ALTER TABLE "ServiceStockTopUp" ALTER COLUMN "menuItemId" DROP NOT NULL;
ALTER TABLE "ServiceStockTopUp" ADD COLUMN "shopProductId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ServiceStockLine_sessionId_shopProductId_key" ON "ServiceStockLine"("sessionId", "shopProductId");
CREATE INDEX "ServiceStockLine_shopProductId_idx" ON "ServiceStockLine"("shopProductId");
CREATE INDEX "ServiceStockTopUp_shopProductId_idx" ON "ServiceStockTopUp"("shopProductId");

-- AddForeignKey
ALTER TABLE "ServiceStockLine" ADD CONSTRAINT "ServiceStockLine_shopProductId_fkey" FOREIGN KEY ("shopProductId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceStockTopUp" ADD CONSTRAINT "ServiceStockTopUp_shopProductId_fkey" FOREIGN KEY ("shopProductId") REFERENCES "ShopProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Exactly one catalog target per line / top-up
ALTER TABLE "ServiceStockLine" ADD CONSTRAINT "ServiceStockLine_item_xor" CHECK (
  ("menuItemId" IS NOT NULL AND "shopProductId" IS NULL)
  OR ("menuItemId" IS NULL AND "shopProductId" IS NOT NULL)
);
ALTER TABLE "ServiceStockTopUp" ADD CONSTRAINT "ServiceStockTopUp_item_xor" CHECK (
  ("menuItemId" IS NOT NULL AND "shopProductId" IS NULL)
  OR ("menuItemId" IS NULL AND "shopProductId" IS NOT NULL)
);
