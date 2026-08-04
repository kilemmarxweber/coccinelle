"use server";
import "dotenv/config";
import type { MethodePaiement } from "@/prisma/generated/prisma/client";
import prisma from "@/lib/prisma";

/** Méthodes variées pour tester le rapport CA (CASH / MOBILE / CARTE). */
const METHODES_PAR_INDEX: MethodePaiement[] = [
  "CASH",
  "MOBILE_MONEY",
  "CARTE",
];

export async function seedPaiements() {
  const reservations = await prisma.reservation.findMany({
    orderBy: { codeUnique: "asc" },
  });

  for (let i = 0; i < reservations.length; i++) {
    const res = reservations[i]!;
    const methode = METHODES_PAR_INDEX[i % METHODES_PAR_INDEX.length]!;

    await prisma.paiement.upsert({
      where: { codeUnique: `PAY-${res.id}` },
      update: {
        montant: res.prixTotal,
        methode,
        statut: "PAYE",
      },
      create: {
        id: `pay-${res.id}`,
        codeUnique: `PAY-${res.id}`,
        reservationId: res.id,
        montant: res.prixTotal,
        methode,
        statut: "PAYE",
      },
    });
  }
}
