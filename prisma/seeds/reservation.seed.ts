"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedReservations() {
  const clients = await prisma.client.findMany();
  const trajetsDepart = await prisma.trajetDepart.findMany();

  const specs = [
    {
      i: 0,
      source: "GUICHET" as const,
      prixBillet: 200,
      prixTotal: 400,
      nombrePlaces: 2,
    },
    {
      i: 1,
      source: "EN_LIGNE" as const,
      prixBillet: 250,
      prixTotal: 500,
      nombrePlaces: 2,
    },
  ];

  for (const spec of specs) {
    const client = clients[spec.i];
    const depart = trajetsDepart[spec.i];

    if (!client || !depart) continue;

    await prisma.reservation.upsert({
      where: { codeUnique: `RES-${spec.i}` },
      update: {
        source: spec.source,
        prixBillet: spec.prixBillet,
        prixTotal: spec.prixTotal,
        nombrePlaces: spec.nombrePlaces,
      },
      create: {
        id: `reservation-${spec.i}`,
        codeUnique: `RES-${spec.i}`,

        clientId: client.id,
        trajetId: depart.trajetId,
        trajetDepartId: depart.id,

        dateDepart: depart.dateDepart,
        heureDepart: depart.heureDepart,

        nombrePlaces: spec.nombrePlaces,
        prixBillet: spec.prixBillet,
        prixTotal: spec.prixTotal,
        statut: "CONFIRME",
        source: spec.source,
      },
    });
  }
}
