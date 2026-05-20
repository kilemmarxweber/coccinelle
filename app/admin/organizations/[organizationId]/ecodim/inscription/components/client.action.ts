"use server";

import prisma from "@/lib/prisma";
import { randomUUID } from "crypto";
import { postNextTelemetryPayload } from "next/dist/telemetry/post-telemetry-payload";
export async function searchClients(query: string, organizationId: string) {
  if (!query || !organizationId) return [];

  const q = query.trim();

  const clients = await prisma.client.findMany({
    where: {
      user: {
        members: {
          some: { organizationId },
        },
      },

      OR: [
        {
          user: {
            name: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          user: {
            email: {
              contains: q,
              mode: "insensitive",
            },
          },
        },
        {
          telephone: {
            contains: q,
          },
        },
        {
          societe: {
            contains: q,
            mode: "insensitive",
          },
        },
      ],
    },

    include: {
      user: true,
    },

    take: 10,
  });

  return clients.map((c) => {
    const nameuser = c.user.name?.split(" ") || [];

    return {
      id: c.id,
      nom: nameuser[0] || "",

      prenom: c.prenom ?? "",
      postnom: c.postnom ?? "",
      adresse: c.adresse ?? "",

      telephone: c.telephone ?? "",
      email: c.user.email ?? "",
      societe: c.societe ?? "",

      dateInscription: c.dateInscription
        ? new Date(c.dateInscription).toISOString().split("T")[0]
        : "",
    };
  });
}

export async function createReservation(payload: any) {
  try {
    const reservation = await prisma.$transaction(async (tx) => {
      let clientId = payload.clientId;

      if (!clientId) {
        throw new Error("Client requis");
      }

      const reservation = await tx.reservation.create({
        data: {
          codeUnique: `RES-${Date.now()}`,
          clientId,
          trajetId: payload.trajetId,
          trajetDepartId: payload.trajetDepartId,
          dateDepart: payload.dateDepart,
          heureDepart: payload.heureDepart,
          statut: payload.statutReservation,
          surplusKilos: payload.colis.kilosSupplement || 0,
          montantSurplus: payload.colis.prix || 0,
          nombrePlaces: payload.nombrePlaces,
          nombreKilos: payload.colis.kilosGratuits || 0,

          prixBillet: payload.pricing.totalPassagers,
          prixTotal: payload.pricing.total,
          penalite: payload.penalite ?? 0,
          dateLimiteReport: payload.dateLimiteReport,
          peutReporter: true,
        },
      });

      for (let i = 0; i < payload.passagers.length; i++) {
        const p = payload.passagers[i];

        await tx.passager.create({
          data: {
            codeUnique: `PASS-${Date.now()}-${i}`,
            reservationId: reservation.id,
            clientId: i === 0 ? clientId : null,
            nom: p.nom,
            prenom: p.prenom,
            sexe: p.sexe,
            categorie: p.categorie,
            prix: p.prix,
            ordre: i + 1,
            type: i === 0 ? "CLIENT" : "EXTERNE",
            statut: i === 0 ? "CLIENT" : "EXTERNE",
            occupePlace: p.categorie !== "BEBE",
            dateNaissance: p.dateNaissance ? new Date(p.dateNaissance) : null,
          },
        });
      }

      if (payload.colis?.type) {
        await tx.colis.create({
          data: {
            codeUnique: `COL-${Date.now()}`,
            clientId,
            trajetId: payload.trajetId,
            trajetDepartId: payload.trajetDepartId,
            kilosGratuits: payload.colis.kilosGratuits || 0,
            surplusKilos: payload.colis.kilosSupplement || 0,
            poids: payload.poids || 0,
            montantAPayer: payload.colis.prix || 0,
            type: payload.colis.type,
            montantFixe: payload.colis.type === "SPECIAL" ? payload.colis.montant : null,
            commentaire: payload.colis.commentaire,
          },
        });
      }

      await tx.paiement.create({
        data: {
          codeUnique: `PAY-${Date.now()}`,
          reservationId: reservation.id,
          montant: payload.pricing.total,
          methode:
            payload.modePaiement === "CASH"
              ? "CASH"
              : payload.modePaiement === "MOBILE"
                ? "MOBILE_MONEY"
                : "CARTE",
          statut: "EN_ATTENTE",
        },
      });

      return reservation;
    });

    return {
      success: true,
      data: reservation,
      message: "Réservation créée avec succès",
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Erreur lors de la création",
    };
  }
}
