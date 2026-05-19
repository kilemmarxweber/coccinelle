"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";
export async function seedTrajetProgramme() {
  await prisma.trajetProgramme.createMany({
    data: [
      // Kin → Paris
      {
        id: "prog-1",
        trajetId: "trajet-1",
        jourSemaine: "LUNDI",
        heureDepart: "06:00",
        actif: true,
      },
      {
        id: "prog-2",
        trajetId: "trajet-1",
        jourSemaine: "JEUDI",
        heureDepart: "06:00",
        actif: true,
      },

      // Kin → Bruxelles
      {
        id: "prog-3",
        trajetId: "trajet-2",
        jourSemaine: "MARDI",
        heureDepart: "10:00",
        actif: true,
      },
    ],
    skipDuplicates: true,
  });
}
