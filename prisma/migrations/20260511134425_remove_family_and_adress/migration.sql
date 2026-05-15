/*
  Warnings:

  - You are about to drop the column `membreId` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `Adresse` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Famille` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Membre` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Famille" DROP CONSTRAINT "Famille_adresseId_fkey";

-- DropForeignKey
ALTER TABLE "Membre" DROP CONSTRAINT "Membre_familleId_fkey";

-- DropForeignKey
ALTER TABLE "user" DROP CONSTRAINT "user_membreId_fkey";

-- DropIndex
DROP INDEX "user_email_membreId_key";

-- DropIndex
DROP INDEX "user_membreId_key";

-- AlterTable
ALTER TABLE "user" DROP COLUMN "membreId";

-- DropTable
DROP TABLE "Adresse";

-- DropTable
DROP TABLE "Famille";

-- DropTable
DROP TABLE "Membre";
