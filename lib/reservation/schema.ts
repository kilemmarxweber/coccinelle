import { z } from "zod";

/**
 * Validation Zod — guichet réservation (admin).
 * Partagé entre `actions.ts` (admin) et `lib/reservation/create-reservation.ts`.
 */

/** Entités Prisma avec `@default(uuid())` (client, trajet, réservation, …). */
export const uuidSchema = z.string().uuid("Identifiant invalide.");

/** Organisation Better Auth : id alphanumérique, pas un UUID. */
export const organizationIdSchema = z
  .string()
  .trim()
  .min(1, "Organisation invalide.");

const label = z
  .string()
  .trim()
  .min(1, "Ce champ est requis.")
  .max(120, "Ce champ est trop long.");

const amount = z.coerce.number().min(0, "Montant invalide.");

const modePaiement = z.enum(["CASH", "MOBILE", "CARD"], {
  message: "Mode de paiement requis.",
});

const passager = z.object({
  nom: label,
  prenom: label,
  sexe: z.enum(["M", "F"]),
  categorie: z.enum(["ADULTE", "ENFANT", "BEBE"]),
  dateNaissance: z.string().optional(),
  prix: amount,
  isClient: z.boolean().optional(),
});

const colis = z.object({
  type: z.enum(["ORDINAIRE", "SPECIAL"]).optional(),
  poids: z.union([z.string(), amount]).optional(),
  kilosSupplement: amount.optional(),
  kilosGratuits: amount.optional(),
  montant: amount.optional(),
  commentaire: z.string().optional(),
  prix: amount.optional(),
});

const pricing = z.object({
  totalPassagers: amount,
  totalColis: amount,
  total: amount,
});

export const statutReservationSchema = z.enum([
  "CONFIRME",
  "EMBARQUE",
  "RATE",
  "REPORTE",
  "ANNULE",
]);

export const statutPaiementSchema = z.enum(["EN_ATTENTE", "PAYE", "ECHOUE"]);

export const createReservationSchema = z
  .object({
    clientId: uuidSchema,
    trajetId: uuidSchema,
    trajetDepartId: uuidSchema,
    dateDepart: z.coerce.date({ message: "Date de départ invalide." }),
    heureDepart: z.string().trim().min(1, "Heure de départ requise."),
    nombrePlaces: z.coerce.number().int().min(0).max(20),
    passagers: z.array(passager),
    colis: colis,
    modePaiement: modePaiement,
    statutReservation: statutReservationSchema.default("CONFIRME"),
    penalite: amount.optional(),
    dateLimiteReport: z.coerce.date().nullable().optional(),
    pricing: pricing,
  })
  .superRefine((data, ctx) => {
    if (data.nombrePlaces > 0) {
      if (data.passagers.length !== data.nombrePlaces) {
        ctx.addIssue({
          code: "custom",
          message: "Le nombre de passagers doit correspondre au nombre de places.",
          path: ["passagers"],
        });
      }
      const sieges = data.passagers.filter((p) => p.categorie !== "BEBE").length;
      if (sieges > data.nombrePlaces) {
        ctx.addIssue({
          code: "custom",
          message: "Trop de passagers occupant une place (les bébés n’en occupent pas).",
          path: ["passagers"],
        });
      }
      return;
    }

    if (!data.colis?.type) {
      ctx.addIssue({
        code: "custom",
        message: "Type de colis requis pour une réservation sans place.",
        path: ["colis", "type"],
      });
    }
  });

export const updateReservationSchema = z
  .object({
    organizationId: organizationIdSchema,
    reservationId: uuidSchema,
    statut: statutReservationSchema.optional(),
    penalite: amount.optional(),
    peutReporter: z.boolean().optional(),
    dateLimiteReport: z.coerce.date().nullable().optional(),
    statutPaiement: statutPaiementSchema.optional(),
  })
  .refine(
    (data) =>
      data.statut !== undefined ||
      data.penalite !== undefined ||
      data.peutReporter !== undefined ||
      data.dateLimiteReport !== undefined ||
      data.statutPaiement !== undefined,
    { message: "Aucune modification à enregistrer." },
  );

export const deleteReservationSchema = z.object({
  organizationId: organizationIdSchema,
  reservationId: uuidSchema,
});

export const reservationIdParamsSchema = z.object({
  organizationId: organizationIdSchema,
  reservationId: uuidSchema,
});

export function toMethodePaiement(
  mode: z.infer<typeof modePaiement>,
): "CASH" | "MOBILE_MONEY" | "CARTE" {
  const map = { CASH: "CASH", MOBILE: "MOBILE_MONEY", CARD: "CARTE" } as const;
  return map[mode];
}

export type CreateReservationInput = z.infer<typeof createReservationSchema>;
export type UpdateReservationInput = z.infer<typeof updateReservationSchema>;
export type DeleteReservationInput = z.infer<typeof deleteReservationSchema>;
