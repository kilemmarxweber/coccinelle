"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

const TRAJET_TEMPLATES = [
  {
    key: "kin-paris",
    villeDepart: "Kinshasa",
    villeArrivee: "Paris",
    modeTransport: "AVION" as const,
    kilosGratuits: 30,
    prixParKilo: 8,
    prixBase: 1200,
  },
  {
    key: "kin-bruxelles",
    villeDepart: "Kinshasa",
    villeArrivee: "Bruxelles",
    modeTransport: "AVION" as const,
    kilosGratuits: 25,
    prixParKilo: 7,
    prixBase: 1000,
  },
  {
    key: "kin-matadi",
    villeDepart: "Kinshasa",
    villeArrivee: "Matadi",
    modeTransport: "BUS" as const,
    kilosGratuits: 20,
    prixParKilo: 2,
    prixBase: 35,
  },
  {
    key: "kin-lubumbashi",
    villeDepart: "Kinshasa",
    villeArrivee: "Lubumbashi",
    modeTransport: "BUS" as const,
    kilosGratuits: 20,
    prixParKilo: 3,
    prixBase: 45,
  },
  {
    key: "kin-lubumbashi-avion",
    villeDepart: "Kinshasa",
    villeArrivee: "Lubumbashi",
    modeTransport: "AVION" as const,
    kilosGratuits: 25,
    prixParKilo: 6,
    prixBase: 250,
  },
];

export async function seedTrajets() {
  const orgs = await prisma.organization.findMany({ select: { id: true } });

  if (orgs.length === 0) {
    console.warn("seedTrajets: aucune organisation — exécutez seedOrganization d'abord.");
    return;
  }

  for (const org of orgs) {
    for (const t of TRAJET_TEMPLATES) {
      await prisma.trajet.upsert({
        where: { id: `${org.id}-${t.key}` },
        create: {
          id: `${org.id}-${t.key}`,
          organizationId: org.id,
          villeDepart: t.villeDepart,
          villeArrivee: t.villeArrivee,
          modeTransport: t.modeTransport,
          kilosGratuits: t.kilosGratuits,
          prixParKilo: t.prixParKilo,
          prixBase: t.prixBase,
        },
        update: {
          modeTransport: t.modeTransport,
          villeDepart: t.villeDepart,
          villeArrivee: t.villeArrivee,
          kilosGratuits: t.kilosGratuits,
          prixParKilo: t.prixParKilo,
          prixBase: t.prixBase,
        },
      });
    }
  }
}
