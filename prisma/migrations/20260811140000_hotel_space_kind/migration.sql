-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "HotelSpaceKind" AS ENUM ('ROOM', 'MEETING');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterTable
ALTER TABLE "HotelRoomType" ADD COLUMN IF NOT EXISTS "kind" "HotelSpaceKind" NOT NULL DEFAULT 'ROOM';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HotelRoomType_branchId_kind_idx" ON "HotelRoomType"("branchId", "kind");
