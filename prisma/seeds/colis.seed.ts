"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedColis() {
  console.log("📦 Seeding colis...");

  const clients = await prisma.client.findMany();
  const trajets = await prisma.trajet.findMany();

  for (let i = 0; i < 5; i++) {
    await prisma.colis.create({
      data: {
        id: crypto.randomUUID(),
        codeUnique: `COL-${Date.now()}-${i}`,
        clientId: clients[i % clients.length].id,
        trajetId: trajets[i % trajets.length].id,
        poids: 35,
        kilosGratuits: 30,
        surplusKilos: 5,
        montantAPayer: 40,
      },
    });
  }

  console.log("✅ Colis OK");
}
