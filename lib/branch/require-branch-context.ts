import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { canAccessBranch, type AccessibleBranch } from "@/lib/branch/user-branches";
import {
  branchDashboardPath,
  moduleForBranchType,
  type BranchModule,
} from "@/lib/branch/paths";

type LoadOpts = {
  organizationId: string;
  branchId: string;
  /** Si défini, refuse l’accès si le type de branche ne matche pas. */
  requireModule?: BranchModule;
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

  return branch;
}
