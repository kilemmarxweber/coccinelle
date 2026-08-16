import { z } from "zod";
import { ALL_ORG_ROLE_SLUGS } from "@/lib/permissions";
import { OPS_ROLE_SLUGS } from "@/lib/branch/ops-roles";

const orgRoleRefine = (role: string) =>
  (ALL_ORG_ROLE_SLUGS as readonly string[]).includes(role);

/** Slugs seed connus OU slug custom BranchRole. */
const opsRoleRefine = (role: string) =>
  (OPS_ROLE_SLUGS as readonly string[]).includes(role) ||
  /^[a-z][a-z0-9_]{1,47}$/.test(role);

export const createOrgMemberSchema = z.object({
  organizationId: z.string().min(1),
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
  orgRole: z.string().refine(orgRoleRefine, "Rôle d’organisation invalide."),
  opsRole: z
    .string()
    .min(1, "Métier branche requis.")
    .refine(opsRoleRefine, "Métier branche invalide."),
  branchIds: z
    .array(z.string().min(1))
    .min(1, "Sélectionnez au moins une branche."),
});

export const updateOrgMemberSchema = z.object({
  organizationId: z.string().min(1),
  memberId: z.string().min(1),
  orgRole: z.string().refine(orgRoleRefine, "Rôle d’organisation invalide."),
  opsRole: z
    .string()
    .min(1, "Métier branche requis.")
    .refine(opsRoleRefine, "Métier branche invalide."),
  branchIds: z
    .array(z.string().min(1))
    .min(1, "Sélectionnez au moins une branche."),
  phone: z
    .string()
    .trim()
    .max(30, "Téléphone trop long.")
    .optional()
    .or(z.literal("")),
});

export const removeOrgMemberSchema = z.object({
  organizationId: z.string().min(1),
  memberId: z.string().min(1),
});

export const resetOrgMemberPasswordSchema = z.object({
  organizationId: z.string().min(1),
  memberId: z.string().min(1),
});

export type CreateOrgMemberInput = z.infer<typeof createOrgMemberSchema>;
export type UpdateOrgMemberInput = z.infer<typeof updateOrgMemberSchema>;
export type RemoveOrgMemberInput = z.infer<typeof removeOrgMemberSchema>;
export type ResetOrgMemberPasswordInput = z.infer<
  typeof resetOrgMemberPasswordSchema
>;
