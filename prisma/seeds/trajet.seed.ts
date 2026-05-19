"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedTrajets() {
  await prisma.trajet.createMany({
    data: [
      {
        id: "trajet-1",
        villeDepart: "Kinshasa",
        villeArrivee: "Paris",
        kilosGratuits: 30,
        prixParKilo: 8,
        prixBase: 1200,
      },
      {
        id: "trajet-2",
        villeDepart: "Kinshasa",
        villeArrivee: "Bruxelles",
        kilosGratuits: 25,
        prixParKilo: 7,
        prixBase: 1000,
      },
    ],
    skipDuplicates: true,
  });
}
