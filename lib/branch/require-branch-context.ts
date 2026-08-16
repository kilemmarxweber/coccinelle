import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  canAccessStays,
  canAccessRestaurant,
  canAccessLivraison,
  type HospitalityModule,
} from "@/lib/branch/hospitality";
import { canAccessBranch, type AccessibleBranch } from "@/lib/branch/user-branches";
import {
  branchDashboardPath,
  moduleForBranchType,
  type BranchModule,
} from "@/lib/branch/paths";
import {
  assertOrganizationPermission,
  type OrganizationPermissionMap,
} from "@/lib/auth/organization-permission";
import { assertDashCardVoir } from "@/lib/branch/dash-card-permissions";

type LoadOpts = {
  organizationId: string;
  branchId: string;
  /** Si défini, refuse l’accès si le type de branche ne matche pas. */
  requireModule?: BranchModule;
  /** Module hospitalité (stays / restaurant / livraison). */
  requireHospitality?: HospitalityModule;
  /**
   * Carte hub requise → permission catalogue `voir` (R06).
   * Remplace l’ancien filtre ROLE_CARDS / canSeeDashCard.
   */
  requireDashCard?: string;
  /** Permission catalogue directe (ex. `{ chambres: ["voir"] }`). */
  requirePermission?: OrganizationPermissionMap;
};

/**
 * Charge la branche + vérifie session / accès / type module / catalogue.
 * À utiliser dans les pages sous `branches/[branchId]/…`.
 */
export async function requireBranchContext(
  opts: LoadOpts,
): Promise<AccessibleBranch> {
  const h = await headers();
  const session = await auth.api.getSession({ headers: h });
  const hub = branchDashboardPath(opts.organizationId, opts.branchId);

  if (!session?.user) {
    redirect(`/auth/sign-in?callbackUrl=${encodeURIComponent(hub)}`);
  }

  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    opts.branchId,
  );
  if (!branch || branch.organizationId !== opts.organizationId) {
    notFound();
  }

  if (opts.requireModule) {
    const actual = moduleForBranchType(branch.type);
    if (actual !== opts.requireModule) {
      redirect(hub);
    }
  }

  if (opts.requireHospitality) {
    const ok =
      opts.requireHospitality === "stays"
        ? canAccessStays(branch)
        : opts.requireHospitality === "restaurant"
          ? canAccessRestaurant(branch)
          : canAccessLivraison(branch);
    if (!ok) redirect(hub);
  }

  if (opts.requirePermission) {
    const perm = await assertOrganizationPermission(
      opts.organizationId,
      opts.requirePermission,
    );
    if (!perm.ok) redirect(hub);
  }

  if (opts.requireDashCard) {
    const card = await assertDashCardVoir(
      opts.organizationId,
      opts.requireDashCard,
    );
    if (!card.ok) redirect(hub);
  }

  return branch;
}
