import type { SourceReservation } from "@/prisma/generated/prisma/client";
import { Prisma } from "@/prisma/generated/prisma/client";
import prisma from "@/lib/prisma";
import {
  assertCapaciteDisponible,
  CapaciteInsuffisanteError,
  placesDemandeesFromPassagers,
} from "@/lib/reservation/capacite";
import {
  toMethodePaiement,
  type CreateReservationInput,
} from "@/lib/reservation/schema";
import {
  assertClientInOrganization,
  assertTrajetScope,
} from "@/lib/reservation/org-scope";
import { reservationUniqueCode } from "@/lib/reservation/unique-code";

export type CreateReservationOptions = {
  organizationId: string;
  source?: SourceReservation;
  /** Statut du paiement à la création (guichet cash → PAYE possible côté appelant). */
  paiementStatut?: "EN_ATTENTE" | "PAYE" | "ECHOUE";
  /** Référence prestataire / stub (ex. `STUB-…`). */
  paiementReference?: string | null;
};

function isWriteConflict(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034"
  );
}

export async function createReservationInDatabase(
  data: CreateReservationInput,
  options: CreateReservationOptions,
) {
  const {
    organizationId,
    source = "GUICHET",
    paiementStatut = "EN_ATTENTE",
    paiementReference = null,
  } = options;

  await assertClientInOrganization(data.clientId, organizationId);
  await assertTrajetScope(organizationId, data.trajetId, data.trajetDepartId);

  const placesDemandees = placesDemandeesFromPassagers(data.passagers);
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await assertCapaciteDisponible(tx, data.trajetDepartId, placesDemandees);

          const clientId = data.clientId;

          const reservation = await tx.reservation.create({
            data: {
              codeUnique: reservationUniqueCode("RES"),
              clientId,
              trajetId: data.trajetId,
              trajetDepartId: data.trajetDepartId,
              dateDepart: data.dateDepart,
              heureDepart: data.heureDepart,
              statut: data.statutReservation,
              source,
              surplusKilos: data.colis.kilosSupplement ?? 0,
              montantSurplus: data.colis.prix ?? 0,
              nombrePlaces: data.nombrePlaces,
              nombreKilos: data.colis.kilosGratuits ?? 0,
              prixBillet: data.pricing.totalPassagers,
              prixTotal: data.pricing.total,
              penalite: data.penalite ?? 0,
              dateLimiteReport: data.dateLimiteReport ?? null,
              peutReporter: true,
            },
          });

          for (let i = 0; i < data.passagers.length; i++) {
            const p = data.passagers[i];
            await tx.passager.create({
              data: {
                codeUnique: reservationUniqueCode(`PASS-${i}`),
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

          if (data.colis?.type) {
            const poidsColis =
              data.colis.poids === undefined || data.colis.poids === ""
                ? 0
                : Number(data.colis.poids);

            await tx.colis.create({
              data: {
                codeUnique: reservationUniqueCode("COL"),
                clientId,
                trajetId: data.trajetId,
                trajetDepartId: data.trajetDepartId,
                kilosGratuits: data.colis.kilosGratuits ?? 0,
                surplusKilos: data.colis.kilosSupplement ?? 0,
                poids: Number.isFinite(poidsColis) ? poidsColis : 0,
                montantAPayer: data.colis.prix ?? 0,
                type: data.colis.type,
                montantFixe:
                  data.colis.type === "SPECIAL" ? (data.colis.montant ?? null) : null,
                commentaire: data.colis.commentaire,
                destinataireNom: data.colis.destinataireNom?.trim() || null,
                destinataireTel: data.colis.destinataireTel?.trim() || null,
                destinataireId: data.colis.destinataireId?.trim() || null,
              },
            });
          }

          await tx.paiement.create({
            data: {
              codeUnique: reservationUniqueCode("PAY"),
              reservationId: reservation.id,
              montant: data.pricing.total,
              methode: toMethodePaiement(data.modePaiement),
              statut: paiementStatut,
              reference: paiementReference,
            },
          });

          return reservation;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5000,
          timeout: 10000,
        },
      );
    } catch (err) {
      if (err instanceof CapaciteInsuffisanteError) throw err;
      if (isWriteConflict(err) && attempt < MAX_RETRIES - 1) continue;
      throw err;
    }
  }

  throw new Error("Impossible de créer la réservation (conflit de concurrence).");
}
