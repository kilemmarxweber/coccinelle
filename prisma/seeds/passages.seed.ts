"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedPassagers() {
  console.log("🧍 Seeding passagers...");

  const reservations = await prisma.reservation.findMany();

  for (const res of reservations) {
    for (let i = 0; i < res.nombrePlaces; i++) {
      await prisma.passager.create({
        data: {
          id: crypto.randomUUID(),
          reservationId: res.id,
          codeUnique: `PASS-${Date.now()}-${i}`,
          nom: "Doe",
          prenom: `Passenger-${i}`,
          categorie: "ADULTE",
          prix: 200,
          type: "CLIENT",
          statut: "CLIENT",
          ordre: i + 1,
        },
      });
    }
  }

  console.log("✅ Passagers OK");
}
