export function sessionMustChangePassword(session: {
  user?: { mustChangePassword?: boolean | null };
} | null | undefined): boolean {
  return session?.user?.mustChangePassword === true;
}
