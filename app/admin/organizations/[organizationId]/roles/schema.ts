import { z } from "zod";

const slugSchema = z
  .string()
  .trim()
  .min(2, "Le slug doit contenir au moins 2 caractères.")
  .max(64, "Le slug est trop long.")
  .regex(
    /^[a-z][a-z0-9_-]*$/,
    "Slug : minuscules, chiffres, tirets ou underscores (commence par une lettre).",
  );

const permissionSchema = z.record(z.string(), z.array(z.string()));

export const createOrgRoleInputSchema = z.object({
  organizationId: z.string().min(1),
  role: slugSchema,
  permission: permissionSchema.default({}),
  /** Preset R02 optionnel — préremplit si permission vide côté action. */
  preset: z.string().optional(),
});

export const updateOrgRoleInputSchema = z.object({
  organizationId: z.string().min(1),
  roleId: z.string().min(1),
  roleName: slugSchema.optional(),
  permission: permissionSchema.optional(),
});

export const deleteOrgRoleInputSchema = z.object({
  organizationId: z.string().min(1),
  roleId: z.string().min(1),
});

export const duplicateOrgRoleInputSchema = z.object({
  organizationId: z.string().min(1),
  sourceRoleId: z.string().min(1),
  role: slugSchema,
});

export type CreateOrgRoleInput = z.infer<typeof createOrgRoleInputSchema>;
export type UpdateOrgRoleInput = z.infer<typeof updateOrgRoleInputSchema>;
export type DeleteOrgRoleInput = z.infer<typeof deleteOrgRoleInputSchema>;
export type DuplicateOrgRoleInput = z.infer<typeof duplicateOrgRoleInputSchema>;
