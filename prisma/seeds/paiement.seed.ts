"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedPaiements() {
  console.log("💳 Seeding paiements...");

  const reservations = await prisma.reservation.findMany();

  for (const res of reservations) {
    await prisma.paiement.create({
      data: {
        id: crypto.randomUUID(),
        codeUnique: `PAY-${Date.now()}`,
        reservationId: res.id,
        montant: res.prixTotal,
        methode: "CASH",
        statut: "PAYE",
      },
    });
  }

  console.log("✅ Paiements OK");
}
