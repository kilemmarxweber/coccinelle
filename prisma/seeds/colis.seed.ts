"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedColis() {
  const clients = await prisma.client.findMany();
  const trajets = await prisma.trajet.findMany();

  for (let i = 0; i < 2; i++) {
    await prisma.colis.upsert({
      where: { codeUnique: `COL-${i}` },
      update: {},
      create: {
        id: `colis-${i}`,
        codeUnique: `COL-${i}`,
        clientId: clients[i].id,
        trajetId: trajets[i].id,
        poids: 35,
        kilosGratuits: 30,
        surplusKilos: 5,
        montantAPayer: 40,
        type: "ORDINAIRE",
      },
    });
  }
}
