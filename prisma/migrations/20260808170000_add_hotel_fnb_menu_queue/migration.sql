-- CreateEnum
CREATE TYPE "HotelFoodOrderStatus" AS ENUM ('NEW', 'PREPARING', 'READY', 'SERVED');

-- CreateEnum
CREATE TYPE "HotelFoodOrderSource" AS ENUM ('STAFF_SUR_PLACE', 'CLIENT_ONLINE');

-- CreateEnum
CREATE TYPE "HotelRestaurantTableStatus" AS ENUM ('FREE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE');

-- CreateTable
CREATE TABLE "HotelMenuCategory" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelMenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelMenuItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelRestaurantTable" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "status" "HotelRestaurantTableStatus" NOT NULL DEFAULT 'FREE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelFoodOrder" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stayId" TEXT,
    "tableId" TEXT,
    "source" "HotelFoodOrderSource" NOT NULL DEFAULT 'STAFF_SUR_PLACE',
    "status" "HotelFoodOrderStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelFoodOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelFoodOrderLine" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelFoodOrderLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HotelMenuCategory_branchId_idx" ON "HotelMenuCategory"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelMenuCategory_branchId_name_key" ON "HotelMenuCategory"("branchId", "name");

-- CreateIndex
CREATE INDEX "HotelMenuItem_categoryId_idx" ON "HotelMenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "HotelRestaurantTable_branchId_idx" ON "HotelRestaurantTable"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelRestaurantTable_branchId_number_key" ON "HotelRestaurantTable"("branchId", "number");

-- CreateIndex
CREATE INDEX "HotelFoodOrder_branchId_status_idx" ON "HotelFoodOrder"("branchId", "status");

-- CreateIndex
CREATE INDEX "HotelFoodOrder_branchId_createdAt_idx" ON "HotelFoodOrder"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "HotelFoodOrder_stayId_idx" ON "HotelFoodOrder"("stayId");

-- CreateIndex
CREATE INDEX "HotelFoodOrder_tableId_idx" ON "HotelFoodOrder"("tableId");

-- CreateIndex
CREATE INDEX "HotelFoodOrderLine_orderId_idx" ON "HotelFoodOrderLine"("orderId");

-- CreateIndex
CREATE INDEX "HotelFoodOrderLine_menuItemId_idx" ON "HotelFoodOrderLine"("menuItemId");

-- AddForeignKey
ALTER TABLE "HotelMenuCategory" ADD CONSTRAINT "HotelMenuCategory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelMenuItem" ADD CONSTRAINT "HotelMenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "HotelMenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelRestaurantTable" ADD CONSTRAINT "HotelRestaurantTable_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelFoodOrder" ADD CONSTRAINT "HotelFoodOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelFoodOrder" ADD CONSTRAINT "HotelFoodOrder_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "HotelStay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelFoodOrder" ADD CONSTRAINT "HotelFoodOrder_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "HotelRestaurantTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelFoodOrderLine" ADD CONSTRAINT "HotelFoodOrderLine_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "HotelFoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelFoodOrderLine" ADD CONSTRAINT "HotelFoodOrderLine_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "HotelMenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
