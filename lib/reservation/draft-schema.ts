import { z } from "zod";

/**
 * Schémas Zod — brouillon checkout PWA (`ReservationDraft.payload`).
 * Alignés sur le domaine réservation (passagers + colis / destinataire U03).
 */

const labelOptional = z.string().trim().max(120);

const draftPassagerLoose = z.object({
  nom: labelOptional.default(""),
  prenom: labelOptional.default(""),
  sexe: z.enum(["M", "F"]).default("M"),
  categorie: z.enum(["ADULTE", "ENFANT", "BEBE"]).default("ADULTE"),
  telephone: z.string().trim().optional(),
});

const draftPassagerStrict = z.object({
  nom: z
    .string()
    .trim()
    .min(1, "Nom requis.")
    .max(120, "Nom trop long."),
  prenom: z
    .string()
    .trim()
    .min(1, "Prénom requis.")
    .max(120, "Prénom trop long."),
  sexe: z.enum(["M", "F"], { message: "Sexe requis." }),
  categorie: z.enum(["ADULTE", "ENFANT", "BEBE"]),
  telephone: z.string().trim().optional(),
});

const draftColisLoose = z.object({
  include: z.boolean().default(false),
  type: z.enum(["ORDINAIRE", "SPECIAL"]).optional(),
  poids: z.union([z.string(), z.coerce.number()]).optional(),
  montantFixe: z.coerce.number().min(0).optional(),
  commentaire: z.string().optional(),
  destinataireNom: z.string().trim().optional(),
  destinataireTel: z.string().trim().optional(),
  destinataireId: z.string().trim().optional(),
});

export const draftCheckoutStepSchema = z.enum([
  "passagers",
  "options",
  "paiement",
]);

/** Payload stocké / autosave (tolérant aux champs incomplets). */
export const draftPayloadPersistSchema = z.object({
  trajetDepartId: z.string().trim().min(1),
  trajetId: z.string().trim().min(1),
  step: draftCheckoutStepSchema.default("passagers"),
  passagers: z.array(draftPassagerLoose).default([]),
  colis: draftColisLoose.default({ include: false }),
});

function refineColisDestinataire(
  colis: z.infer<typeof draftColisLoose>,
  ctx: z.RefinementCtx,
) {
  if (!colis.include) return;
  if (!colis.type) {
    ctx.addIssue({
      code: "custom",
      message: "Type de colis requis.",
      path: ["colis", "type"],
    });
  }
  if (!colis.destinataireNom?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Nom du destinataire requis lorsqu’un colis est présent.",
      path: ["colis", "destinataireNom"],
    });
  }
  if (!colis.destinataireTel?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Téléphone du destinataire requis lorsqu’un colis est présent.",
      path: ["colis", "destinataireTel"],
    });
  }
  if (!colis.destinataireId?.trim()) {
    ctx.addIssue({
      code: "custom",
      message: "Pièce d’identité du destinataire requise lorsqu’un colis est présent.",
      path: ["colis", "destinataireId"],
    });
  }
}

/** Validation étape Passagers (au moins un passager renseigné). */
export const draftPassengersAdvanceSchema = z
  .object({
    passagers: z.array(draftPassagerStrict).min(1, "Ajoutez au moins un passager."),
  })
  .superRefine((data, ctx) => {
    const sieges = data.passagers.filter((p) => p.categorie !== "BEBE").length;
    if (sieges < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Au moins un passager doit occuper une place (adulte ou enfant).",
        path: ["passagers"],
      });
    }
  });

/** Validation étape Options (destinataire si colis). */
export const draftOptionsAdvanceSchema = z
  .object({
    passagers: z.array(draftPassagerStrict).min(1),
    colis: draftColisLoose,
  })
  .superRefine((data, ctx) => {
    refineColisDestinataire(data.colis, ctx);
    const sieges = data.passagers.filter((p) => p.categorie !== "BEBE").length;
    if (sieges < 1) {
      ctx.addIssue({
        code: "custom",
        message: "Au moins un passager doit occuper une place (adulte ou enfant).",
        path: ["passagers"],
      });
    }
  });

export const createDraftInputSchema = z.object({
  orgSlug: z.string().trim().min(1),
  departId: z.string().trim().min(1),
});

export const updateDraftInputSchema = z.object({
  orgSlug: z.string().trim().min(1),
  draftToken: z.string().trim().min(1),
  payload: draftPayloadPersistSchema,
});

export type DraftCheckoutStep = z.infer<typeof draftCheckoutStepSchema>;
export type DraftPayload = z.infer<typeof draftPayloadPersistSchema>;
export type DraftPassager = z.infer<typeof draftPassagerStrict>;
export type DraftColis = z.infer<typeof draftColisLoose>;
