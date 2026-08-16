import { z } from "zod";

/**
 * R04 — schéma équipe branche.
 *
 * Règle produit `owner` : assignation interdite sauf admin plateforme
 * ou membre org avec rôle `owner` (vérifiée côté serveur, pas ici).
 */

export const createBranchStaffSchema = z.object({
  organizationId: z.string().min(1),
  branchId: z.string().min(1),
  email: z
    .string()
    .trim()
    .min(1, "L’email est requis.")
    .email("Adresse email invalide."),
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom est trop long."),
  phone: z
    .string()
    .trim()
    .max(30, "Téléphone trop long.")
    .optional()
    .or(z.literal("")),
  orgRole: z
    .string()
    .trim()
    .min(1, "Rôle requis.")
    .max(64, "Slug de rôle trop long."),
});

export const updateBranchStaffRoleSchema = z.object({
  organizationId: z.string().min(1),
  branchId: z.string().min(1),
  memberId: z.string().min(1),
  orgRole: z
    .string()
    .trim()
    .min(1, "Rôle requis.")
    .max(64, "Slug de rôle trop long."),
});

export const removeBranchStaffSchema = z.object({
  organizationId: z.string().min(1),
  branchId: z.string().min(1),
  memberId: z.string().min(1),
});

export type CreateBranchStaffInput = z.infer<typeof createBranchStaffSchema>;
export type UpdateBranchStaffRoleInput = z.infer<
  typeof updateBranchStaffRoleSchema
>;
export type RemoveBranchStaffInput = z.infer<typeof removeBranchStaffSchema>;
