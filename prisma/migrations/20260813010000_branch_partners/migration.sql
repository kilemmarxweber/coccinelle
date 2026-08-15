-- CreateEnum
CREATE TYPE "PaymentMethod_new" AS ENUM ('CASH', 'MOBILE_MONEY', 'CARTE', 'BANK');
ALTER TABLE "Payment" ALTER COLUMN "method" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod_new" USING ("method"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "PaymentMethod_old";
ALTER TABLE "Payment" ALTER COLUMN "method" SET DEFAULT 'CASH';

CREATE TYPE "BranchPartnerStatus" AS ENUM ('ACTIVE', 'INACTIVE');
CREATE TYPE "PartnerIdDocumentType" AS ENUM ('CNI', 'PASSPORT', 'PERMIS', 'AUTRE');
CREATE TYPE "PartnerBookingStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_HOUSE', 'CHECKING_OUT', 'CLOSED', 'CANCELLED');
CREATE TYPE "PartnerPayTiming" AS ENUM ('PREPAID', 'AT_CHECKOUT');

CREATE TABLE "BranchPartner" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "taxId" TEXT,
    "idDocumentType" "PartnerIdDocumentType" NOT NULL,
    "idDocumentNumber" TEXT NOT NULL,
    "idDocumentImageUrl" TEXT NOT NULL,
    "idDocumentCapturedAt" TIMESTAMP(3),
    "notes" TEXT,
    "status" "BranchPartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "defaultUnitPriceHint" DOUBLE PRECISION,
    "defaultDiscountPctHint" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BranchPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PartnerBooking" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "payTiming" "PartnerPayTiming" NOT NULL DEFAULT 'AT_CHECKOUT',
    "status" "PartnerBookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerBooking_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "HotelStay" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
ALTER TABLE "HotelStay" ADD COLUMN IF NOT EXISTS "partnerBookingId" TEXT;

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "partnerBookingId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "bankReference" TEXT;

CREATE INDEX "BranchPartner_branchId_status_idx" ON "BranchPartner"("branchId", "status");
CREATE INDEX "BranchPartner_branchId_name_idx" ON "BranchPartner"("branchId", "name");
CREATE INDEX "BranchPartner_branchId_idDocumentNumber_idx" ON "BranchPartner"("branchId", "idDocumentNumber");

CREATE UNIQUE INDEX "PartnerBooking_branchId_code_key" ON "PartnerBooking"("branchId", "code");
CREATE INDEX "PartnerBooking_branchId_status_idx" ON "PartnerBooking"("branchId", "status");
CREATE INDEX "PartnerBooking_partnerId_idx" ON "PartnerBooking"("partnerId");

CREATE INDEX "HotelStay_partnerId_idx" ON "HotelStay"("partnerId");
CREATE INDEX "HotelStay_partnerBookingId_idx" ON "HotelStay"("partnerBookingId");

CREATE INDEX "Payment_partnerId_idx" ON "Payment"("partnerId");
CREATE INDEX "Payment_partnerBookingId_idx" ON "Payment"("partnerBookingId");

ALTER TABLE "BranchPartner" ADD CONSTRAINT "BranchPartner_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerBooking" ADD CONSTRAINT "PartnerBooking_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PartnerBooking" ADD CONSTRAINT "PartnerBooking_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "BranchPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "BranchPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_partnerBookingId_fkey" FOREIGN KEY ("partnerBookingId") REFERENCES "PartnerBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "BranchPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_partnerBookingId_fkey" FOREIGN KEY ("partnerBookingId") REFERENCES "PartnerBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
