import { z } from "zod";

/** Aligné sur les limites Better Auth (email + mot de passe). */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * Code d’autorisation inscription (en dur, jamais stocké en base).
 * Requis avant `signUp` — non envoyé à Better Auth.
 */
export const SIGN_UP_ADMIN_CODE = "Coccinellev041191";

export const SIGN_UP_ADMIN_CODE_ERROR =
  "Veuillez contacter l’administrateur du système.";

export const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "L’email est requis.")
    .email("Adresse email invalide."),
  password: z.string().min(1, "Le mot de passe est requis."),
});

export const signUpSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins 2 caractères.")
    .max(120, "Le nom est trop long."),
  email: z
    .string()
    .trim()
    .min(1, "L’email est requis.")
    .email("Adresse email invalide."),
  password: z
    .string()
    .min(
      MIN_PASSWORD_LENGTH,
      `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    )
    .max(MAX_PASSWORD_LENGTH, "Le mot de passe est trop long."),
  adminCode: z
    .string()
    .trim()
    .min(1, "Le code de validation est requis.")
    .refine((value) => value === SIGN_UP_ADMIN_CODE, {
      message: SIGN_UP_ADMIN_CODE_ERROR,
    }),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
