-- CreateTable
CREATE TABLE "HotelPayment" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "stayId" TEXT,
    "foodOrderId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" "MethodePaiement" NOT NULL,
    "status" "StatutPaiement" NOT NULL DEFAULT 'PAYE',
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HotelPayment_branchId_idx" ON "HotelPayment"("branchId");

-- CreateIndex
CREATE INDEX "HotelPayment_stayId_idx" ON "HotelPayment"("stayId");

-- CreateIndex
CREATE INDEX "HotelPayment_foodOrderId_idx" ON "HotelPayment"("foodOrderId");

-- CreateIndex
CREATE INDEX "HotelPayment_branchId_createdAt_idx" ON "HotelPayment"("branchId", "createdAt");

-- AddForeignKey
ALTER TABLE "HotelPayment" ADD CONSTRAINT "HotelPayment_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelPayment" ADD CONSTRAINT "HotelPayment_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "HotelStay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelPayment" ADD CONSTRAINT "HotelPayment_foodOrderId_fkey" FOREIGN KEY ("foodOrderId") REFERENCES "HotelFoodOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
