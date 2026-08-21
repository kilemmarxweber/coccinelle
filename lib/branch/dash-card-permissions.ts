/**
 * R06 — Cartes hub → permissions catalogue FR (`Ressource · Voir`).
 * Source d’autorité : Better Auth / `assertOrganizationPermission` (plus ROLE_CARDS).
 */

import {
  assertOrganizationPermission,
  type OrganizationPermissionMap,
} from "@/lib/auth/organization-permission";
import { DASH_CARD, type DashCardId } from "@/lib/branch/ops-roles";
import {
  filterMenuSectionsByVisibleCardIds,
  type BranchMenuSection,
} from "@/lib/branch/branch-menus";

/** Carte hub → permission `voir` (ou équivalent catalogue). */
export const DASH_CARD_VOIR_PERMISSION: Record<
  string,
  OrganizationPermissionMap
> = {
  [DASH_CARD.CAISSE]: { caisse: ["voir"] },
  [DASH_CARD.TAUX_CHANGE]: { taux_change: ["voir"] },
  [DASH_CARD.SEJOURS]: { sejours: ["voir"] },
  [DASH_CARD.RESTAURATION]: { restauration: ["voir"] },
  [DASH_CARD.CUISINE]: { cuisine: ["voir"] },
  [DASH_CARD.SERVICE_STOCK]: { service_stock: ["voir"] },
  [DASH_CARD.CHAMBRES]: { chambres: ["voir"] },
  [DASH_CARD.SALLES]: { salles: ["voir"] },
  [DASH_CARD.PRODUITS_HOTEL]: { produits_hotel: ["voir"] },
  [DASH_CARD.LIVRAISON]: { livraison: ["voir"] },
  [DASH_CARD.BONS_COMMANDE]: { bons_commande: ["voir"] },
  [DASH_CARD.DEPENSES]: { depenses: ["voir"] },
  [DASH_CARD.EQUIPE]: { equipe: ["voir"] },
  [DASH_CARD.PAIE]: { paie: ["gerer"] },
  [DASH_CARD.PAIE_PRESENCES]: { paie: ["pointer"] },
  [DASH_CARD.PAIE_MOI]: { paie: ["voir"] },
  [DASH_CARD.RAPPORT_TABLEAU]: { rapport_tableau: ["voir"] },
  [DASH_CARD.RAPPORT_VENTES]: { rapport_ventes: ["voir"] },
  [DASH_CARD.RAPPORT_ACHATS]: { rapport_achats: ["voir"] },
  [DASH_CARD.RAPPORT_FINANCIER]: { rapport_financier: ["voir"] },
  [DASH_CARD.RAPPORT_ARTICLES]: { rapport_articles: ["voir"] },
  [DASH_CARD.RAPPORT_MES_COMMANDES]: { rapport_mes_commandes: ["voir"] },
  [DASH_CARD.RAPPORT_SEJOURS]: { rapport_sejours: ["voir"] },
  [DASH_CARD.CLIENTS_PARTENAIRES]: { partenaires: ["voir"] },
  [DASH_CARD.POS]: { boutique_pos: ["voir"] },
  [DASH_CARD.BOUTIQUE_PRODUITS]: { boutique_produits: ["voir"] },
  [DASH_CARD.BOUTIQUE_STOCK]: { boutique_stock: ["voir"] },
  [DASH_CARD.GUICHET]: { inscription: ["ajouter"] },
  [DASH_CARD.RESERVATIONS]: { inscription: ["voir"] },
  [DASH_CARD.CLIENTS]: { clients_agence: ["voir"] },
  [DASH_CARD.TRAJETS]: { trajet: ["voir"] },
  [DASH_CARD.COLIS]: { colis: ["voir"] },
  [DASH_CARD.EMBARQUEMENT]: { embarquement: ["voir"] },
};

export function voirPermissionForDashCard(
  cardId: string | undefined | null,
): OrganizationPermissionMap | null {
  if (!cardId) return null;
  return DASH_CARD_VOIR_PERMISSION[cardId] ?? null;
}

/** IDs de cartes hub autorisées (`voir`) — plain data pour props client. */
export async function resolveVisibleDashCardIds(
  organizationId: string,
  cardIds: readonly string[],
): Promise<string[]> {
  const unique = [...new Set(cardIds)];
  const checks = await Promise.all(
    unique.map(async (id) => {
      const perm = voirPermissionForDashCard(id);
      if (!perm) return [id, true] as const;
      const result = await assertOrganizationPermission(organizationId, perm);
      return [id, result.ok] as const;
    }),
  );
  return checks.filter(([, ok]) => ok).map(([id]) => id);
}

/** Filtre hub : carte visible si permission catalogue `voir`. */
export async function filterMenuSectionsByCatalog(
  organizationId: string,
  sections: BranchMenuSection[],
): Promise<BranchMenuSection[]> {
  const cardIds = sections.flatMap((s) =>
    s.items.map((i) => i.id).filter((id): id is string => Boolean(id)),
  );
  const visibleCardIds = await resolveVisibleDashCardIds(
    organizationId,
    cardIds,
  );
  return filterMenuSectionsByVisibleCardIds(sections, visibleCardIds);
}

export async function assertDashCardVoir(
  organizationId: string,
  cardId: DashCardId | string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const perm = voirPermissionForDashCard(cardId);
  if (!perm) return { ok: true };
  return assertOrganizationPermission(organizationId, perm);
}
