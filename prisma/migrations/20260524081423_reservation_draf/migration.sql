-- DropForeignKey
ALTER TABLE "TrajetDepart" DROP CONSTRAINT "TrajetDepart_trajetId_fkey";

-- AddForeignKey
ALTER TABLE "TrajetDepart" ADD CONSTRAINT "TrajetDepart_trajetId_fkey" FOREIGN KEY ("trajetId") REFERENCES "Trajet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
