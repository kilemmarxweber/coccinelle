/*
  Warnings:

  - Added the required column `trajetDepartId` to the `Reservation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "JourSemaine" AS ENUM ('LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI', 'DIMANCHE');

-- DropForeignKey
ALTER TABLE "Colis" DROP CONSTRAINT "Colis_trajetId_fkey";

-- DropForeignKey
ALTER TABLE "Reservation" DROP CONSTRAINT "Reservation_trajetId_fkey";

-- AlterTable
ALTER TABLE "Colis" ADD COLUMN     "trajetDepartId" TEXT;

-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN     "trajetDepartId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "TrajetProgramme" (
    "id" TEXT NOT NULL,
    "trajetId" TEXT NOT NULL,
    "jourSemaine" "JourSemaine" NOT NULL,
    "heureDepart" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TrajetProgramme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrajetDepart" (
    "id" TEXT NOT NULL,
    "trajetId" TEXT NOT NULL,
    "dateDepart" TIMESTAMP(3) NOT NULL,
    "heureDepart" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'PLANIFIE',

    CONSTRAINT "TrajetDepart_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TrajetProgramme" ADD CONSTRAINT "TrajetProgramme_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrajetDepart" ADD CONSTRAINT "TrajetDepart_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_trajetDepartId_fkey" FOREIGN KEY ("trajetDepartId") REFERENCES "TrajetDepart"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Colis" ADD CONSTRAINT "Colis_trajetDepartId_fkey" FOREIGN KEY ("trajetDepartId") REFERENCES "TrajetDepart"("id") ON DELETE SET NULL ON UPDATE CASCADE;
