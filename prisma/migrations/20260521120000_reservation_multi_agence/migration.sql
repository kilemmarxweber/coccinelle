-- CreateEnum
CREATE TYPE "StatutTrajetDepart" AS ENUM ('PLANIFIE', 'OUVERT', 'ANNULE');

-- CreateEnum
CREATE TYPE "SourceReservation" AS ENUM ('GUICHET', 'EN_LIGNE');

-- Multi-agence: lier chaque trajet à une organisation
ALTER TABLE "Trajet" ADD COLUMN "organizationId" TEXT;

UPDATE "Trajet" SET "organizationId" = 'org-1' WHERE "organizationId" IS NULL;

ALTER TABLE "Trajet" ALTER COLUMN "organizationId" SET NOT NULL;

-- DropIndex
DROP INDEX "Trajet_villeDepart_villeArrivee_idx";

-- CreateIndex
CREATE INDEX "Trajet_organizationId_villeDepart_villeArrivee_idx" ON "Trajet"("organizationId", "villeDepart", "villeArrivee");

-- AddForeignKey
ALTER TABLE "Trajet" ADD CONSTRAINT "Trajet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- TrajetDepart.statut: TEXT -> enum (conserver les valeurs existantes)
ALTER TABLE "TrajetDepart" ADD COLUMN "statut_new" "StatutTrajetDepart";

UPDATE "TrajetDepart"
SET "statut_new" = CASE
  WHEN UPPER("statut") = 'ANNULE' THEN 'ANNULE'::"StatutTrajetDepart"
  WHEN UPPER("statut") = 'OUVERT' THEN 'OUVERT'::"StatutTrajetDepart"
  ELSE 'PLANIFIE'::"StatutTrajetDepart"
END;

ALTER TABLE "TrajetDepart" DROP COLUMN "statut";
ALTER TABLE "TrajetDepart" RENAME COLUMN "statut_new" TO "statut";
ALTER TABLE "TrajetDepart" ALTER COLUMN "statut" SET NOT NULL;
ALTER TABLE "TrajetDepart" ALTER COLUMN "statut" SET DEFAULT 'PLANIFIE';

-- CreateIndex
CREATE INDEX "TrajetDepart_trajetId_dateDepart_idx" ON "TrajetDepart"("trajetId", "dateDepart");
CREATE INDEX "TrajetDepart_statut_idx" ON "TrajetDepart"("statut");

-- Reservation: source + FK trajet
ALTER TABLE "Reservation" ADD COLUMN "source" "SourceReservation" NOT NULL DEFAULT 'GUICHET';

CREATE INDEX "Reservation_trajetDepartId_idx" ON "Reservation"("trajetDepartId");
CREATE INDEX "Reservation_source_idx" ON "Reservation"("source");

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Colis: FK trajet
ALTER TABLE "Colis" ADD CONSTRAINT "Colis_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Brouillon wizard client (reprise après OTP)
CREATE TABLE "ReservationDraft" (
    "id" TEXT NOT NULL,
    "draftToken" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "payload" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReservationDraft_draftToken_key" ON "ReservationDraft"("draftToken");
CREATE INDEX "ReservationDraft_organizationId_userId_idx" ON "ReservationDraft"("organizationId", "userId");
CREATE INDEX "ReservationDraft_expiresAt_idx" ON "ReservationDraft"("expiresAt");

ALTER TABLE "ReservationDraft" ADD CONSTRAINT "ReservationDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReservationDraft" ADD CONSTRAINT "ReservationDraft_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
