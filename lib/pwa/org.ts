import { cache } from "react";
import prisma from "@/lib/prisma";

export type PublicOrganization = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
};

/**
 * Résout une org publique par slug (PWA).
 * Inconnue → `null` (la page appelle `notFound()`).
 */
export const getPublicOrganizationBySlug = cache(
  async (slug: string): Promise<PublicOrganization | null> => {
    const trimmed = slug.trim();
    if (!trimmed) return null;

    return prisma.organization.findUnique({
      where: { slug: trimmed },
      select: { id: true, name: true, slug: true, logo: true },
    });
  },
);
