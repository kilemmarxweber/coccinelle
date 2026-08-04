-- CreateEnum
CREATE TYPE "ModeTransport" AS ENUM ('BUS', 'AVION');

-- DropForeignKey
ALTER TABLE "TrajetDepart" DROP CONSTRAINT "TrajetDepart_trajetId_fkey";

-- AlterTable
ALTER TABLE "Trajet" ADD COLUMN     "modeTransport" "ModeTransport" NOT NULL DEFAULT 'BUS';

-- CreateIndex
CREATE INDEX "Trajet_organizationId_modeTransport_idx" ON "Trajet"("organizationId", "modeTransport");

-- AddForeignKey
ALTER TABLE "TrajetDepart" ADD CONSTRAINT "TrajetDepart_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
