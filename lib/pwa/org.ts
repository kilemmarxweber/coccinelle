import { cache } from "react";
import prisma from "@/lib/prisma";
import { loadOrganizationCustomerUiTheme } from "@/lib/branch/load-customer-ui-theme";
import type { CustomerUiTheme } from "@/lib/branch/customer-ui-theme";

export type PublicOrganization = {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
};

export type PublicOrganizationWithTheme = PublicOrganization & {
  customerUiTheme: CustomerUiTheme;
  customerUiEnabled: boolean;
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

export const getPublicOrganizationThemeBySlug = cache(
  async (slug: string): Promise<PublicOrganizationWithTheme | null> => {
    const org = await getPublicOrganizationBySlug(slug);
    if (!org) return null;
    const customerUi = await loadOrganizationCustomerUiTheme(org.id);
    return {
      ...org,
      customerUiTheme: customerUi.theme,
      customerUiEnabled: customerUi.isCustom,
    };
  },
);
