import { z } from "zod";
import { OPS_ROLE_SLUGS } from "@/lib/branch/ops-roles";
import { ORG_ROLE } from "@/lib/permissions";

/** Depuis une branche : Admin ou User uniquement — jamais owner. */
const branchOrgRoleSchema = z.enum([ORG_ROLE.ADMIN, ORG_ROLE.USER], {
  message: "Choisissez Admin ou User.",
});

const opsRoleRefine = (role: string) =>
  (OPS_ROLE_SLUGS as readonly string[]).includes(role) ||
  /^[a-z][a-z0-9_]{1,47}$/.test(role);

export const createBranchStaffSchema = z.object({
  organizationId: z.string().min(1),
  branchId: z.string().min(1),
  email: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || z.string().email().safeParse(v).success,
      "Adresse email invalide.",
    ),
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
  orgRole: branchOrgRoleSchema,
  opsRole: z
    .string()
    .trim()
    .min(1, "Métier branche requis.")
    .refine(opsRoleRefine, "Métier branche invalide."),
});

export const updateBranchStaffRoleSchema = z.object({
  organizationId: z.string().min(1),
  branchId: z.string().min(1),
  memberId: z.string().min(1),
  orgRole: branchOrgRoleSchema,
  opsRole: z
    .string()
    .trim()
    .min(1, "Métier branche requis.")
    .refine(opsRoleRefine, "Métier branche invalide."),
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
