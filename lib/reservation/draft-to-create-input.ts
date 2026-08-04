import {
  placesDemandeesFromPassagers,
} from "@/lib/reservation/capacite";
import {
  draftOptionsAdvanceSchema,
  type DraftPayload,
} from "@/lib/reservation/draft-schema";
import {
  computeReservationPricing,
  type TrajetTarifs,
} from "@/lib/reservation/pricing";
import type { CreateReservationInput } from "@/lib/reservation/schema";

type DepartPricingContext = {
  dateDepart: string | Date;
  heureDepart: string;
  tarifs: TrajetTarifs;
};

/**
 * Transforme un brouillon checkout validé en payload `createReservationInDatabase`.
 */
export function draftPayloadToCreateInput(
  payload: DraftPayload,
  clientId: string,
  depart: DepartPricingContext,
  modePaiement: CreateReservationInput["modePaiement"] = "MOBILE",
): CreateReservationInput {
  const validated = draftOptionsAdvanceSchema.parse({
    passagers: payload.passagers,
    colis: payload.colis,
  });

  const colisInput =
    validated.colis.include && validated.colis.type
      ? {
          type: validated.colis.type,
          poids: validated.colis.poids,
          montantFixe: validated.colis.montantFixe,
        }
      : undefined;

  const pricing = computeReservationPricing(
    depart.tarifs,
    validated.passagers,
    colisInput,
  );

  const passagers = validated.passagers.map((p, i) => ({
    nom: p.nom,
    prenom: p.prenom,
    sexe: p.sexe,
    categorie: p.categorie,
    prix: pricing.passagerLines[i]?.prix ?? 0,
    isClient: i === 0,
  }));

  const hasColis = Boolean(validated.colis.include && validated.colis.type);

  return {
    clientId,
    trajetId: payload.trajetId,
    trajetDepartId: payload.trajetDepartId,
    dateDepart: new Date(depart.dateDepart),
    heureDepart: depart.heureDepart,
    nombrePlaces: passagers.length,
    passagers,
    colis: hasColis
      ? {
          type: validated.colis.type!,
          poids: validated.colis.poids,
          kilosSupplement: pricing.colis.kilosSupplement,
          kilosGratuits: pricing.colis.kilosGratuits,
          montant:
            validated.colis.type === "SPECIAL"
              ? validated.colis.montantFixe
              : undefined,
          commentaire: validated.colis.commentaire,
          prix: pricing.totalColis,
          destinataireNom: validated.colis.destinataireNom,
          destinataireTel: validated.colis.destinataireTel,
          destinataireId: validated.colis.destinataireId,
        }
      : { prix: 0 },
    modePaiement,
    statutReservation: "CONFIRME",
    pricing: {
      totalPassagers: pricing.totalPassagers,
      totalColis: pricing.totalColis,
      total: pricing.total,
    },
    dateLimiteReport: null,
  };
}

export function draftSeatsRequested(payload: DraftPayload): number {
  return placesDemandeesFromPassagers(payload.passagers);
}
