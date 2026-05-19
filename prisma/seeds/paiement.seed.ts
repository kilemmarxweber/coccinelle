"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedPaiements() {
  const reservations = await prisma.reservation.findMany();

  for (const res of reservations) {
    await prisma.paiement.upsert({
      where: { codeUnique: `PAY-${res.id}` },
      update: {},
      create: {
        id: `pay-${res.id}`,
        codeUnique: `PAY-${res.id}`,
        reservationId: res.id,
        montant: res.prixTotal,
        methode: "CASH",
        statut: "PAYE",
      },
    });
  }
}
