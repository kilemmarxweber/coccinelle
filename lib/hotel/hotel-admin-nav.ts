/**
 * Navigation sidebar Admin hôtel — chemins via `hotelRoutes`,
 * filtrée par permissions Better Auth (même matrices que le hub `branch-menus`).
 */

import type { OrganizationPermissionMap } from "@/lib/auth/organization-permission";
import { hotelRoutes } from "@/lib/branch/paths";
import { hasOrganizationPermission } from "@/lib/hotel/hotel-permission";

export type HotelAdminNavKey =
  | "accueil"
  | "chambres"
  | "sejours"
  | "restauration"
  | "caisse";

export type HotelAdminNavItem = {
  key: HotelAdminNavKey;
  label: string;
  href: string;
  /** Absente = toujours visible dans le shell hôtel. */
  permission?: OrganizationPermissionMap;
};

/** Items de nav (chemins stables) — filtrer avec `resolveHotelAdminNavItems`. */
export function hotelAdminNavItems(
  organizationId: string,
  branchId: string,
): HotelAdminNavItem[] {
  return [
    {
      key: "accueil",
      label: "Accueil hôtel",
      href: hotelRoutes.root(organizationId, branchId),
    },
    {
      key: "chambres",
      label: "Chambres",
      href: hotelRoutes.chambres(organizationId, branchId),
      permission: { hotel_room: ["read"] },
    },
    {
      key: "sejours",
      label: "Séjours",
      href: hotelRoutes.sejours(organizationId, branchId),
      permission: { hotel_stay: ["read"] },
    },
    {
      key: "restauration",
      label: "Restauration",
      href: hotelRoutes.restauration(organizationId, branchId),
      permission: { hotel_fnb: ["read"] },
    },
    {
      key: "caisse",
      label: "Caisse",
      href: hotelRoutes.caisse(organizationId, branchId),
      // Aligné hub : réceptionniste / caissier / gérant / owner — pas le serveur seul
      permission: { hotel_stay: ["update"] },
    },
  ];
}

/** Filtre la nav selon les permissions org (Better Auth). */
export async function resolveHotelAdminNavItems(
  organizationId: string,
  branchId: string,
): Promise<HotelAdminNavItem[]> {
  const items = hotelAdminNavItems(organizationId, branchId);
  const resolved: HotelAdminNavItem[] = [];

  for (const item of items) {
    if (!item.permission) {
      resolved.push(item);
      continue;
    }
    const allowed = await hasOrganizationPermission(
      organizationId,
      item.permission,
    );
    if (allowed) resolved.push(item);
  }

  return resolved;
}
