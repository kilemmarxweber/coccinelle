import { signInSchema } from "@/app/auth/schema";

/** Rejette un corps de connexion mal formé avant qu’il n’atteigne la base. */
export function loginInputError(email: unknown, password: unknown): string | null {
  const parsed = signInSchema.safeParse({ email, password });
  if (parsed.success) return null;
  return parsed.error.issues[0]?.message ?? "Identifiants invalides.";
}
