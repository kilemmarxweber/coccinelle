import { z } from "zod";

const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const createOrganizationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom est trop long."),
  slug: z
    .string()
    .trim()
    .min(2, "Le slug doit contenir au moins 2 caractères.")
    .max(64, "Le slug est trop long.")
    .regex(slugRegex, "Utilisez des minuscules, des chiffres et des tirets (ex. mon-Coccinelle)."),
});

export type CreateOrganizationFormValues = z.infer<typeof createOrganizationFormSchema>;
