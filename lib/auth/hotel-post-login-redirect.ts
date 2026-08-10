import { auth } from "@/lib/auth";
import { getUserOrganizationMembership } from "@/lib/auth/org-membership";
import { safeHotelCallbackUrl } from "@/lib/auth/safe-hotel-callback-url";
import { clientHotelRoutes, hotelRoutes } from "@/lib/branch/paths";
import { listAccessibleBranches } from "@/lib/branch/user-branches";
import {
  isAppAdminRole,
  organizationRoleStatements,
} from "@/lib/permissions";
import prisma from "@/lib/prisma";

function roleHasHotelPermission(role: string): boolean {
  const statements = organizationRoleStatements[role];
  if (!statements) return false;
  return Boolean(
    statements.hotel_room?.length ||
      statements.hotel_stay?.length ||
      statements.hotel_fnb?.length,
  );
}

async function memberHasHotelStaffRights(
  userId: string,
  organizationId: string,
): Promise<boolean> {
  const member = await prisma.member.findFirst({
    where: { userId, organizationId },
    select: { role: true },
  });
  if (!member) return false;
  const roles = member.role
    .split(",")
    .map((r) => r.trim())
    .filter(Boolean);
  return roles.some(roleHasHotelPermission);
}

/**
 * Destination après login depuis l’espace Client hôtel.
 * - `callbackUrl` safe sous `/{orgSlug}/hotel/…` prioritaire
 * - staff avec droits `hotel_*` → hub Admin branche HOTEL
 * - sinon client → `/{orgSlug}/hotel/mes-sejours`
 */
export async function resolveHotelPostLoginPath(
  requestHeaders: Headers,
  orgSlug: string,
  callbackUrl?: string | null,
): Promise<string> {
  const safeCallback = safeHotelCallbackUrl(callbackUrl, orgSlug);
  if (safeCallback) return safeCallback;

  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session?.user) {
    return clientHotelRoutes.connexion(orgSlug);
  }

  const org = await prisma.organization.findUnique({
    where: { slug: orgSlug },
    select: { id: true },
  });
  if (!org) {
    return clientHotelRoutes.mesSejours(orgSlug);
  }

  const membership = await getUserOrganizationMembership(session.user.id);
  if (membership?.organizationId === org.id) {
    await auth.api.setActiveOrganization({
      body: { organizationId: org.id },
      headers: requestHeaders,
    });
  }

  const isStaff =
    isAppAdminRole(session.user.role) ||
    (await memberHasHotelStaffRights(session.user.id, org.id));

  if (isStaff) {
    const branches = await listAccessibleBranches(
      session.user.id,
      session.user.role,
      org.id,
    );
    const hotelBranch = branches.find((b) => b.type === "HOTEL");
    if (hotelBranch) {
      return hotelRoutes.root(org.id, hotelBranch.id);
    }
  }

  return clientHotelRoutes.mesSejours(orgSlug);
}
