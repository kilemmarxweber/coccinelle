"use server";
import "dotenv/config";
import prisma from "@/lib/prisma";

export async function seedTrajetProgramme() {
  const trajets = await prisma.trajet.findMany();

  const data: Array<{
    id: string;
    trajetId: string;
    jourSemaine: "LUNDI" | "MARDI" | "MERCREDI" | "JEUDI" | "VENDREDI" | "SAMEDI";
    heureDepart: string;
    actif: boolean;
  }> = [];

  for (const trajet of trajets) {
    if (trajet.villeArrivee === "Paris") {
      data.push(
        {
          id: `prog-${trajet.id}-lun`,
          trajetId: trajet.id,
          jourSemaine: "LUNDI",
          heureDepart: "06:00",
          actif: true,
        },
        {
          id: `prog-${trajet.id}-jeu`,
          trajetId: trajet.id,
          jourSemaine: "JEUDI",
          heureDepart: "06:00",
          actif: true,
        },
      );
    }
    if (trajet.villeArrivee === "Bruxelles") {
      data.push({
        id: `prog-${trajet.id}-mar`,
        trajetId: trajet.id,
        jourSemaine: "MARDI",
        heureDepart: "10:00",
        actif: true,
      });
    }
    if (trajet.villeArrivee === "Lubumbashi" && trajet.modeTransport === "BUS") {
      data.push(
        {
          id: `prog-${trajet.id}-mer`,
          trajetId: trajet.id,
          jourSemaine: "MERCREDI",
          heureDepart: "07:00",
          actif: true,
        },
        {
          id: `prog-${trajet.id}-sam`,
          trajetId: trajet.id,
          jourSemaine: "SAMEDI",
          heureDepart: "07:00",
          actif: true,
        },
      );
    }
    if (trajet.villeArrivee === "Lubumbashi" && trajet.modeTransport === "AVION") {
      data.push({
        id: `prog-${trajet.id}-ven`,
        trajetId: trajet.id,
        jourSemaine: "VENDREDI",
        heureDepart: "14:00",
        actif: true,
      });
    }
  }

  if (data.length === 0) return;

  await prisma.trajetProgramme.createMany({ data, skipDuplicates: true });
}
