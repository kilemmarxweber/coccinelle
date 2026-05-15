/*
  Warnings:

  - You are about to drop the column `updatedAt` on the `organization` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[email]` on the table `user` will be added. If there are existing duplicate values, this will fail.
  - Made the column `expiresAt` on table `invitation` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "member_organizationId_userId_key";

-- DropIndex
DROP INDEX "organizationRole_organizationId_role_key";

-- AlterTable
ALTER TABLE "invitation" ALTER COLUMN "role" DROP NOT NULL,
ALTER COLUMN "expiresAt" SET NOT NULL;

-- AlterTable
ALTER TABLE "member" ALTER COLUMN "role" SET DEFAULT 'member',
ALTER COLUMN "createdAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organization" DROP COLUMN "updatedAt",
ALTER COLUMN "metadata" SET DATA TYPE TEXT,
ALTER COLUMN "createdAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organizationRole" ALTER COLUMN "permission" SET DATA TYPE TEXT,
ALTER COLUMN "updatedAt" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "role" DROP NOT NULL,
ALTER COLUMN "role" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "organizationRole_role_idx" ON "organizationRole"("role");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
