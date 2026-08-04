import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { generatePassengerQr } from "@/lib/reservation/passenger-qr";
import type { TicketReservation } from "@/lib/reservation/ticket-data";

export type ClientReservationListItem = {
  id: string;
  codeUnique: string;
  statut: string;
  source: string;
  dateDepart: Date;
  heureDepart: string;
  prixTotal: number;
  createdAt: Date;
  villeDepart: string;
  villeArrivee: string;
  paiementStatut: string | null;
  passagerCount: number;
};

async function requireSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user?.id ?? null;
}

/** Réservations du client connecté pour une org (par `client.userId`). */
export const listMyReservationsForOrg = cache(
  async (organizationId: string): Promise<ClientReservationListItem[] | null> => {
    const userId = await requireSessionUserId();
    if (!userId) return null;

    const rows = await prisma.reservation.findMany({
      where: {
        client: { userId },
        trajet: { organizationId },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        codeUnique: true,
        statut: true,
        source: true,
        dateDepart: true,
        heureDepart: true,
        prixTotal: true,
        createdAt: true,
        trajet: {
          select: {
            villeDepart: true,
            villeArrivee: true,
          },
        },
        paiements: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { statut: true },
        },
        passagers: { select: { id: true } },
      },
    });

    return rows.map((r) => ({
      id: r.id,
      codeUnique: r.codeUnique,
      statut: r.statut,
      source: r.source,
      dateDepart: r.dateDepart,
      heureDepart: r.heureDepart,
      prixTotal: r.prixTotal,
      createdAt: r.createdAt,
      villeDepart: r.trajet.villeDepart,
      villeArrivee: r.trajet.villeArrivee,
      paiementStatut: r.paiements[0]?.statut ?? null,
      passagerCount: r.passagers.length,
    }));
  },
);

/** Détail d’une réservation appartenant au user session (scope org). */
export async function getMyReservationForOrg(input: {
  organizationId: string;
  reservationId?: string;
  codeUnique?: string;
}) {
  const userId = await requireSessionUserId();
  if (!userId) return null;

  return prisma.reservation.findFirst({
    where: {
      ...(input.reservationId
        ? { id: input.reservationId }
        : { codeUnique: input.codeUnique?.trim() }),
      client: { userId },
      trajet: { organizationId: input.organizationId },
    },
    include: {
      client: {
        select: {
          telephone: true,
          prenom: true,
          postnom: true,
          userId: true,
          user: { select: { name: true } },
        },
      },
      trajet: {
        select: {
          villeDepart: true,
          villeArrivee: true,
          modeTransport: true,
          organizationId: true,
          organization: { select: { name: true, logo: true, slug: true } },
        },
      },
      passagers: {
        orderBy: { ordre: "asc" },
        select: {
          id: true,
          nom: true,
          prenom: true,
          categorie: true,
          prix: true,
          codeUnique: true,
          occupePlace: true,
        },
      },
      paiements: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          methode: true,
          montant: true,
          statut: true,
          reference: true,
        },
      },
    },
  });
}

/** Confirmation publique par code : propriétaire session uniquement. */
export async function getMyReservationByCodeForOrg(input: {
  organizationId: string;
  codeUnique: string;
}) {
  return getMyReservationForOrg({
    organizationId: input.organizationId,
    codeUnique: input.codeUnique,
  });
}

export async function buildTicketFromReservation(
  reservation: NonNullable<Awaited<ReturnType<typeof getMyReservationForOrg>>>,
): Promise<TicketReservation> {
  const passagers = await Promise.all(
    reservation.passagers.map(async (p) => {
      const qr = await generatePassengerQr(p.codeUnique);
      return {
        id: p.id,
        nom: p.nom,
        prenom: p.prenom,
        categorie: p.categorie,
        prix: p.prix,
        codeUnique: p.codeUnique,
        occupePlace: p.occupePlace,
        qrDataUrl: qr.dataUrl,
        qrPayload: qr.payload,
      };
    }),
  );

  const paiement = reservation.paiements[0] ?? null;
  const displayName =
    reservation.client.user.name ||
    [reservation.client.prenom, reservation.client.postnom]
      .filter(Boolean)
      .join(" ") ||
    "Client";

  return {
    codeUnique: reservation.codeUnique,
    dateDepart: reservation.dateDepart,
    heureDepart: reservation.heureDepart,
    prixBillet: reservation.prixBillet,
    prixTotal: reservation.prixTotal,
    organization: {
      name: reservation.trajet.organization.name,
      logo: reservation.trajet.organization.logo,
    },
    trajet: {
      villeDepart: reservation.trajet.villeDepart,
      villeArrivee: reservation.trajet.villeArrivee,
      modeTransport: reservation.trajet.modeTransport,
    },
    client: {
      displayName,
      telephone: reservation.client.telephone,
    },
    passagers,
    paiement: paiement
      ? {
          methode: paiement.methode,
          montant: paiement.montant,
          statut: paiement.statut,
        }
      : null,
  };
}
