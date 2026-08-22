import prisma from "@/lib/prisma";
import { suggestMemberEmail } from "@/lib/slug";

export { suggestMemberEmail } from "@/lib/slug";

/**
 * Email saisi, ou généré depuis le nom si vide (comme un slug).
 * Si l’email correspond au slug généré, on le rend unique en cas de collision.
 */
export async function resolveMemberEmail(input: {
  email: string;
  name: string;
  organizationSlug: string;
}): Promise<{ ok: true; email: string } | { ok: false; message: string }> {
  const trimmed = input.email.trim().toLowerCase();
  const suggested = suggestMemberEmail(
    input.name,
    input.organizationSlug,
  )?.toLowerCase();

  if (!trimmed) {
    if (!suggested) {
      return { ok: false, message: "L’email est requis." };
    }
    return allocateUniqueMemberEmail(suggested);
  }

  if (suggested && trimmed === suggested) {
    return allocateUniqueMemberEmail(suggested);
  }

  return { ok: true, email: trimmed };
}

async function allocateUniqueMemberEmail(
  base: string,
): Promise<{ ok: true; email: string } | { ok: false; message: string }> {
  const at = base.indexOf("@");
  if (at < 1) {
    return { ok: false, message: "L’email est requis." };
  }
  const local = base.slice(0, at);
  const domain = base.slice(at + 1);
  let candidate = base;
  for (let n = 2; n <= 99; n++) {
    const existing = await prisma.user.findUnique({
      where: { email: candidate },
      select: { id: true },
    });
    if (!existing) return { ok: true, email: candidate };
    candidate = `${local}-${n}@${domain}`;
  }
  return { ok: false, message: "Impossible de générer un email unique." };
}
