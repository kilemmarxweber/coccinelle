"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedPenalites() {
  const reservations = await prisma.reservation.findMany();

  if (!reservations.length) {
    console.log("⚠️ No reservations found, skipping penalites seed");
    return;
  }

  for (let i = 0; i < reservations.length; i++) {
    const res = reservations[i];

    if (!res) continue; // safety

    await prisma.penalite.upsert({
      where: { codeUnique: `PEN-${res.id}` },
      update: {},
      create: {
        id: `pen-${res.id}`,
        codeUnique: `PEN-${res.id}`,
        reservationId: res.id,
        montant: 50,
        raison: "Annulation tardive",
      },
    });
  }

  console.log("✅ Penalites seeded");
}
