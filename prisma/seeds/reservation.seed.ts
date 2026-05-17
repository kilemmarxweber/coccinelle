"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedReservations() {
  console.log("📦 Seeding reservations...");

  const clients = await prisma.client.findMany();
  const trajets = await prisma.trajet.findMany();

  if (!clients.length || !trajets.length) {
    throw new Error("Clients or Trajets missing");
  }

  for (let i = 0; i < 5; i++) {
    const client = clients[i % clients.length];
    const trajet = trajets[i % trajets.length];

    await prisma.reservation.create({
      data: {
        id: crypto.randomUUID(),
        codeUnique: `RES-${Date.now()}-${i}`,
        clientId: client.id,
        trajetId: trajet.id,
        dateDepart: new Date(),
        heureDepart: "10:00",
        nombrePlaces: 2,
        prixBillet: 200,
        prixTotal: 400,
      },
    });
  }

  console.log("✅ Reservations OK");
}
