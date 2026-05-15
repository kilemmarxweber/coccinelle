/**
 * Mot de passe en clair, réservé au flux admin `createUser` : associé à l’email juste avant l’appel
 * Better Auth, consommé dans `databaseHooks.user.create.after` pour l’email de bienvenue.
 * Mémoire processus uniquement (multi-instances / serverless : prévoir un store partagé si besoin).
 */
const pendingByEmail = new Map<string, string>();

export function stashAdminCreatedUserPlainPassword(email: string, plainPassword: string): void {
  pendingByEmail.set(email.trim().toLowerCase(), plainPassword);
}

export function consumeAdminCreatedUserPlainPassword(email: string): string | undefined {
  const key = email.trim().toLowerCase();
  const value = pendingByEmail.get(key);
  pendingByEmail.delete(key);
  return value;
}
