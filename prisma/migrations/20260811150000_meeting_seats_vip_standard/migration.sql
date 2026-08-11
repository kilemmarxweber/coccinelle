-- AlterTable: détail places pour salles de réunion
ALTER TABLE "HotelRoomType" ADD COLUMN IF NOT EXISTS "seatsStandard" INTEGER;
ALTER TABLE "HotelRoomType" ADD COLUMN IF NOT EXISTS "seatsVip" INTEGER;
