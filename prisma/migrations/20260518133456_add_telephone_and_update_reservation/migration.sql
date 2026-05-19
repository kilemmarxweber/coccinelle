/*
  Warnings:

  - Added the required column `telephone` to the `Client` table without a default value. This is not possible if the table is not empty.
  - Added the required column `type` to the `Colis` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sexe` to the `Passager` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TypeColis" AS ENUM ('ORDINAIRE', 'SPECIAL');

-- CreateEnum
CREATE TYPE "TypeSexe" AS ENUM ('M', 'F');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "societe" TEXT,
ADD COLUMN     "telephone" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Colis" ADD COLUMN     "commentaire" TEXT,
ADD COLUMN     "montantFixe" DOUBLE PRECISION,
ADD COLUMN     "passagerId" TEXT,
ADD COLUMN     "type" "TypeColis" NOT NULL;

-- AlterTable
ALTER TABLE "Passager" ADD COLUMN     "sexe" "TypeSexe" NOT NULL;

-- AddForeignKey
ALTER TABLE "Colis" ADD CONSTRAINT "Colis_passagerId_fkey" FOREIGN KEY ("passagerId") REFERENCES "Passager"("id") ON DELETE SET NULL ON UPDATE CASCADE;
