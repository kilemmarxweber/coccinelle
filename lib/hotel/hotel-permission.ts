import {
  assertOrganizationPermission,
  type OrganizationPermissionMap,
} from "@/lib/auth/organization-permission";

export type HotelRoomPermission = "create" | "update" | "delete" | "read";
export type HotelStayPermission = "create" | "update" | "delete" | "read";
export type HotelFnbPermission = "create" | "update" | "delete" | "read";

/** Vérifie `hotel_room:*` via Better Auth `hasPermission`. */
export async function assertHotelRoomPermission(
  organizationId: string,
  permission: HotelRoomPermission,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return assertOrganizationPermission(organizationId, {
    hotel_room: [permission],
  });
}

/** Vérifie `hotel_stay:*` via Better Auth `hasPermission`. */
export async function assertHotelStayPermission(
  organizationId: string,
  permission: HotelStayPermission,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return assertOrganizationPermission(organizationId, {
    hotel_stay: [permission],
  });
}

/** Vérifie `hotel_fnb:*` via Better Auth `hasPermission`. */
export async function assertHotelFnbPermission(
  organizationId: string,
  permission: HotelFnbPermission,
): Promise<{ ok: true } | { ok: false; message: string }> {
  return assertOrganizationPermission(organizationId, {
    hotel_fnb: [permission],
  });
}

export async function hasOrganizationPermission(
  organizationId: string,
  permissions: OrganizationPermissionMap,
): Promise<boolean> {
  const result = await assertOrganizationPermission(organizationId, permissions);
  return result.ok;
}
