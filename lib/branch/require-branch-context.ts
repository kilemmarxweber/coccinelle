import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  canAccessStays,
  canAccessRestaurant,
  canAccessLivraison,
  type HospitalityModule,
} from "@/lib/branch/hospitality";
import { isHospitality } from "@/lib/branch/hospitality";
import { canAccessBranch, type AccessibleBranch } from "@/lib/branch/user-branches";
import {
  branchDashboardPath,
  moduleForBranchType,
  type BranchModule,
} from "@/lib/branch/paths";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";
import { canSeeDashCardAsync } from "@/lib/branch/privileges";
import { isCommerceBranchType } from "@/lib/payroll/bootstrap";

type LoadOpts = {
  organizationId: string;
  branchId: string;
  /** Si défini, refuse l’accès si le type de branche ne matche pas. */
  requireModule?: BranchModule;
  /** Famille commerce (BOUTIQUE | USINE) — paie partagée. */
  requireCommerce?: boolean;
  /** Module hospitalité (stays / restaurant / livraison). */
  requireHospitality?: HospitalityModule;
  /** Carte hub requise (filtre rôle ops, hospitalité uniquement). */
  requireDashCard?: string;
};

/**
 * Charge la branche + vérifie session / accès / type module.
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

  if (opts.requireCommerce && !isCommerceBranchType(branch.type)) {
    redirect(hub);
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

  if (opts.requireDashCard && (isHospitality(branch.type) || branch.type === "USINE")) {
    const opsRole = await resolveCurrentBranchOpsRole(
      opts.organizationId,
      opts.branchId,
    );
    if (!(await canSeeDashCardAsync(opsRole, opts.requireDashCard))) {
      redirect(hub);
    }
  }

  return branch;
}
