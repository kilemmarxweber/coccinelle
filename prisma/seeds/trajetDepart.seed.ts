"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";
import { capaciteDefautPourMode } from "@/lib/reservation/capacite";

export async function seedTrajetDepart() {
  const programmes = await prisma.trajetProgramme.findMany({
    include: { trajet: { select: { modeTransport: true } } },
  });

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

  const data: Array<{
    id: string;
    trajetId: string;
    dateDepart: Date;
    heureDepart: string;
    statut: "OUVERT" | "PLANIFIE";
    capacitePlaces: number;
  }> = [];

  for (const p of programmes) {
    const targetDay = dayMap[p.jourSemaine];
    const capacitePlaces = capaciteDefautPourMode(p.trajet.modeTransport);

    for (let i = 0; i < 4; i++) {
      const date = new Date(today);
      const diff = (targetDay - date.getDay() + 7) % 7;
      date.setDate(date.getDate() + diff + i * 7);

      data.push({
        id: `depart-${p.id}-${i}`,
        trajetId: p.trajetId,
        dateDepart: date,
        heureDepart: p.heureDepart,
        statut: i === 0 ? "OUVERT" : "PLANIFIE",
        capacitePlaces:
          i === 0 && p.trajet.modeTransport === "BUS" ? 2 : capacitePlaces,
      });
    }
  }

  await prisma.trajetDepart.createMany({
    data,
    skipDuplicates: true,
  });

  for (const d of data) {
    await prisma.trajetDepart.update({
      where: { id: d.id },
      data: { capacitePlaces: d.capacitePlaces },
    });
  }
}
