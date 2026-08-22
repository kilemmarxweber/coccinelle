/** Identifiant URL / email local : minuscules, chiffres, tirets. */
export function slugifyName(name: string, max = 64): string {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max);
}

/**
 * Email technique dérivé du nom (comme un slug).
 * Ex. « Jean Dupont » + org `kinshasa` → `jean-dupont@kinshasa.coccinelle.local`
 */
export function suggestMemberEmail(
  name: string,
  organizationSlug: string,
): string | null {
  const local = slugifyName(name, 40);
  const domain = slugifyName(organizationSlug, 40) || "org";
  if (local.length < 2) return null;
  return `${local}@${domain}.coccinelle.local`;
}
