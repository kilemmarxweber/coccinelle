"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedReservations() {
  const clients = await prisma.client.findMany();
  const trajetsDepart = await prisma.trajetDepart.findMany();

  for (let i = 0; i < 2; i++) {
    const client = clients[i];
    const depart = trajetsDepart[i];

    if (!client || !depart) continue;

    await prisma.reservation.upsert({
      where: { codeUnique: `RES-${i}` },
      update: {},
      create: {
        id: `reservation-${i}`,
        codeUnique: `RES-${i}`,

        clientId: client.id,
        trajetId: depart.trajetId,
        trajetDepartId: depart.id,

        dateDepart: depart.dateDepart,
        heureDepart: depart.heureDepart,

        nombrePlaces: 2,
        prixBillet: 200,
        prixTotal: 400,
        statut: "CONFIRME",
      },
    });
  }
}
