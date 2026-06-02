"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

const TRAJET_TEMPLATES = [
  {
    key: "kin-paris",
    villeDepart: "Kinshasa",
    villeArrivee: "Paris",
    kilosGratuits: 30,
    prixParKilo: 8,
    prixBase: 1200,
  },
  {
    key: "kin-bruxelles",
    villeDepart: "Kinshasa",
    villeArrivee: "Bruxelles",
    kilosGratuits: 25,
    prixParKilo: 7,
    prixBase: 1000,
  },
];

export async function seedTrajets() {
  const orgs = await prisma.organization.findMany({ select: { id: true } });

  if (orgs.length === 0) {
    console.warn("seedTrajets: aucune organisation — exécutez seedOrganization d'abord.");
    return;
  }

  for (const org of orgs) {
    await prisma.trajet.createMany({
      data: TRAJET_TEMPLATES.map((t) => ({
        id: `${org.id}-${t.key}`,
        organizationId: org.id,
        villeDepart: t.villeDepart,
        villeArrivee: t.villeArrivee,
        kilosGratuits: t.kilosGratuits,
        prixParKilo: t.prixParKilo,
        prixBase: t.prixBase,
      })),
      skipDuplicates: true,
    });
  }
}
