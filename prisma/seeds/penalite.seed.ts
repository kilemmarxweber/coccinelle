"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedPenalites() {
  console.log("⚠️ Seeding penalites...");

  const reservations = await prisma.reservation.findMany();

  for (const res of reservations.slice(0, 2)) {
    await prisma.penalite.create({
      data: {
        id: crypto.randomUUID(),
        codeUnique: `PEN-${Date.now()}`,
        reservationId: res.id,
        montant: 50,
        raison: "Annulation tardive",
      },
    });
  }

  console.log("✅ Penalites OK");
}
