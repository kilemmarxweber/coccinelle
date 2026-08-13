/**
 * Contexte création admin `createUser` : MDP + téléphone + branding,
 * consommé dans `databaseHooks.user.create.after`.
 */
export type AdminCreatedUserStash = {
  password: string;
  phone?: string | null;
  branchId?: string | null;
  organizationName?: string | null;
  role?: string | null;
};

const pendingByEmail = new Map<string, AdminCreatedUserStash>();

export function stashAdminCreatedUserPlainPassword(
  email: string,
  plainPassword: string,
  extra?: Omit<AdminCreatedUserStash, "password">,
): void {
  pendingByEmail.set(email.trim().toLowerCase(), {
    password: plainPassword,
    phone: extra?.phone ?? null,
    branchId: extra?.branchId ?? null,
    organizationName: extra?.organizationName ?? null,
    role: extra?.role ?? null,
  });
}

export function consumeAdminCreatedUserPlainPassword(
  email: string,
): string | undefined {
  const stash = consumeAdminCreatedUserStash(email);
  return stash?.password;
}

export function consumeAdminCreatedUserStash(
  email: string,
): AdminCreatedUserStash | undefined {
  const key = email.trim().toLowerCase();
  const value = pendingByEmail.get(key);
  pendingByEmail.delete(key);
  return value;
}
