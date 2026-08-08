-- AlterTable HotelStay: stay code + optional client user link
ALTER TABLE "HotelStay" ADD COLUMN "codeUnique" TEXT;
ALTER TABLE "HotelStay" ADD COLUMN "userId" TEXT;

UPDATE "HotelStay"
SET "codeUnique" = 'STAY-' || REPLACE("id", '-', '')
WHERE "codeUnique" IS NULL;

ALTER TABLE "HotelStay" ALTER COLUMN "codeUnique" SET NOT NULL;

CREATE UNIQUE INDEX "HotelStay_codeUnique_key" ON "HotelStay"("codeUnique");
CREATE INDEX "HotelStay_userId_idx" ON "HotelStay"("userId");

ALTER TABLE "HotelStay" ADD CONSTRAINT "HotelStay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable HotelStayDraft
CREATE TABLE "HotelStayDraft" (
    "id" TEXT NOT NULL,
    "draftToken" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelStayDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HotelStayDraft_draftToken_key" ON "HotelStayDraft"("draftToken");
CREATE INDEX "HotelStayDraft_organizationId_userId_idx" ON "HotelStayDraft"("organizationId", "userId");
CREATE INDEX "HotelStayDraft_branchId_idx" ON "HotelStayDraft"("branchId");
CREATE INDEX "HotelStayDraft_expiresAt_idx" ON "HotelStayDraft"("expiresAt");

ALTER TABLE "HotelStayDraft" ADD CONSTRAINT "HotelStayDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelStayDraft" ADD CONSTRAINT "HotelStayDraft_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HotelStayDraft" ADD CONSTRAINT "HotelStayDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
