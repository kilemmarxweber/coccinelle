"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedPassagers() {
  const reservations = await prisma.reservation.findMany();

  for (const res of reservations) {
    for (let i = 0; i < res.nombrePlaces; i++) {
      await prisma.passager.upsert({
        where: { codeUnique: `PASS-${res.id}-${i}` },
        update: {},
        create: {
          id: `pass-${res.id}-${i}`,
          reservationId: res.id,
          codeUnique: `PASS-${res.id}-${i}`,
          nom: "Doe",
          prenom: `Passenger-${i}`,
          sexe: "M",
          categorie: "ADULTE",
          prix: 200,
          type: "CLIENT",
          statut: "CLIENT",
          ordre: i + 1,
        },
      });
    }
  }
}
