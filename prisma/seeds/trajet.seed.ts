"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedTrajets() {
  console.log("🌱 Seeding trajets...");

  await prisma.trajet.createMany({
    data: [
      {
        villeDepart: "Kinshasa",
        villeArrivee: "Paris",
        kilosGratuits: 30,
        prixParKilo: 8,
        prixBase: 1200,
        dureeEstimee: 8,
      },
      {
        villeDepart: "Kinshasa",
        villeArrivee: "Bruxelles",
        kilosGratuits: 25,
        prixParKilo: 7,
        prixBase: 1000,
        dureeEstimee: 7,
      },
      {
        villeDepart: "Kinshasa",
        villeArrivee: "Dubaï",
        kilosGratuits: 20,
        prixParKilo: 6,
        prixBase: 900,
        dureeEstimee: 6,
      },
      {
        villeDepart: "Lubumbashi",
        villeArrivee: "Johannesburg",
        kilosGratuits: 15,
        prixParKilo: 5,
        prixBase: 500,
        dureeEstimee: 2,
      },
      {
        villeDepart: "Goma",
        villeArrivee: "Nairobi",
        kilosGratuits: 20,
        prixParKilo: 6.5,
        prixBase: 650,
        dureeEstimee: 3,
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Trajets OK");
}
