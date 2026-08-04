import type { ModeTransport, PrismaClient } from "@/prisma/generated/prisma/client";
import { Prisma } from "@/prisma/generated/prisma/client";
import prisma from "@/lib/prisma";

/** Capacité par défaut selon le mode (seed / création de départ). */
export const CAPACITE_DEFAUT: Record<ModeTransport, number> = {
  BUS: 50,
  AVION: 180,
};

export function capaciteDefautPourMode(mode: ModeTransport): number {
  return CAPACITE_DEFAUT[mode];
}

export class CapaciteInsuffisanteError extends Error {
  readonly placesRestantes: number;
  readonly placesDemandees: number;

  constructor(placesRestantes: number, placesDemandees: number) {
    super(
      `Capacité insuffisante : ${placesRestantes} place${placesRestantes !== 1 ? "s" : ""} restante${placesRestantes !== 1 ? "s" : ""}, ${placesDemandees} demandée${placesDemandees !== 1 ? "s" : ""}.`,
    );
    this.name = "CapaciteInsuffisanteError";
    this.placesRestantes = placesRestantes;
    this.placesDemandees = placesDemandees;
  }
}

type DbClient = PrismaClient | Prisma.TransactionClient;

/** Places consommées = passagers avec `occupePlace` sur réservations non annulées. */
export async function countPlacesOccupees(
  departId: string,
  db: DbClient = prisma,
): Promise<number> {
  return db.passager.count({
    where: {
      occupePlace: true,
      reservation: {
        trajetDepartId: departId,
        statut: { not: "ANNULE" },
      },
    },
  });
}

/**
 * Places restantes = capacité − passagers `occupePlace`.
 * Un bébé (`occupePlace = false`) et un colis seul ne consomment pas de place.
 */
export async function placesRestantes(
  departId: string,
  db: DbClient = prisma,
): Promise<number> {
  const depart = await db.trajetDepart.findUniqueOrThrow({
    where: { id: departId },
    select: { capacitePlaces: true },
  });
  const occupees = await countPlacesOccupees(departId, db);
  return Math.max(0, depart.capacitePlaces - occupees);
}

/** Sièges demandés par une réservation (bébés exclus). */
export function placesDemandeesFromPassagers(
  passagers: Array<{ categorie: string }>,
): number {
  return passagers.filter((p) => p.categorie !== "BEBE").length;
}

/**
 * Verrouille le départ (`FOR UPDATE`), vérifie la capacité, puis laisse l'appelant insérer.
 * Empêche le surbooking sous concurrence.
 */
export async function assertCapaciteDisponible(
  tx: Prisma.TransactionClient,
  departId: string,
  placesDemandees: number,
): Promise<void> {
  if (placesDemandees <= 0) return;

  const locked = await tx.$queryRaw<Array<{ id: string; capacitePlaces: number }>>`
    SELECT id, "capacitePlaces"
    FROM "TrajetDepart"
    WHERE id = ${departId}
    FOR UPDATE
  `;

  const depart = locked[0];
  if (!depart) {
    throw new Error("Départ introuvable.");
  }

  const occupees = await countPlacesOccupees(departId, tx);
  const restantes = Math.max(0, depart.capacitePlaces - occupees);

  if (placesDemandees > restantes) {
    throw new CapaciteInsuffisanteError(restantes, placesDemandees);
  }
}
