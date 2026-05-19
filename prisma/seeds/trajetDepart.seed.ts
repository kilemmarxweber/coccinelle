"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedTrajetDepart() {
  const programmes = await prisma.trajetProgramme.findMany();

  const today = new Date();

  const dayMap: Record<string, number> = {
    LUNDI: 1,
    MARDI: 2,
    MERCREDI: 3,
    JEUDI: 4,
    VENDREDI: 5,
    SAMEDI: 6,
    DIMANCHE: 0,
  };

  const data: any[] = [];

  for (const p of programmes) {
    const targetDay = dayMap[p.jourSemaine];

    for (let i = 0; i < 4; i++) {
      const date = new Date(today);

      // avancer jusqu'au bon jour de semaine
      const diff = (targetDay - date.getDay() + 7) % 7;
      date.setDate(date.getDate() + diff + i * 7);

      data.push({
        id: `depart-${p.id}-${i}`,
        trajetId: p.trajetId,
        dateDepart: date,
        heureDepart: p.heureDepart,
        statut: "PLANIFIE",
      });
    }
  }

  await prisma.trajetDepart.createMany({
    data,
    skipDuplicates: true,
  });
}
