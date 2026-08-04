import type { Prisma } from "@/prisma/generated/prisma/client";
import prisma from "@/lib/prisma";

export class ReservationScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReservationScopeError";
  }
}

export const reservationListInclude = {
  client: {
    include: { user: { select: { id: true, name: true, email: true } } },
  },
  trajet: {
    select: {
      id: true,
      organizationId: true,
      villeDepart: true,
      villeArrivee: true,
      modeTransport: true,
      organization: {
        select: { id: true, name: true, logo: true, slug: true },
      },
    },
  },
  trajetDepart: true,
  passagers: { orderBy: { ordre: "asc" } },
  paiements: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.ReservationInclude;

export async function assertClientInOrganization(
  clientId: string,
  organizationId: string,
): Promise<void> {
  const client = await prisma.client.findFirst({
    where: {
      id: clientId,
      user: { members: { some: { organizationId } } },
    },
    select: { id: true },
  });
  if (!client) {
    throw new ReservationScopeError("Client introuvable pour cette agence.");
  }
}

export async function assertTrajetScope(
  organizationId: string,
  trajetId: string,
  trajetDepartId: string,
): Promise<{ trajetDepartId: string; statut: string }> {
  const depart = await prisma.trajetDepart.findFirst({
    where: {
      id: trajetDepartId,
      trajetId,
      trajet: { organizationId },
    },
    select: { id: true, statut: true, trajetId: true },
  });

  if (!depart) {
    throw new ReservationScopeError("Départ ou trajet invalide pour cette agence.");
  }

  if (depart.statut === "ANNULE") {
    throw new ReservationScopeError("Ce départ n’est plus disponible.");
  }

  if (depart.statut !== "OUVERT") {
    throw new ReservationScopeError(
      "Ce départ n’est pas encore ouvert à la réservation.",
    );
  }

  return { trajetDepartId: depart.id, statut: depart.statut };
}

export async function findReservationForOrganization(
  organizationId: string,
  reservationId: string,
) {
  const reservation = await prisma.reservation.findFirst({
    where: {
      id: reservationId,
      trajet: { organizationId },
    },
    include: reservationListInclude,
  });
  if (!reservation) return null;

  const colis = await prisma.colis.findMany({
    where: {
      clientId: reservation.clientId,
      trajetId: reservation.trajetId,
      trajetDepartId: reservation.trajetDepartId,
    },
    orderBy: { createdAt: "asc" },
  });

  return { ...reservation, colis };
}
