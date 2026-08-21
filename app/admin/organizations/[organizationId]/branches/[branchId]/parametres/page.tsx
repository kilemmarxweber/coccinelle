import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { boutiqueRoutes } from "@/lib/branch/paths";
import { listRolesForParametresAction } from "@/lib/branch/privilege-actions";
import { ParametresRolesClient } from "./parametres-client";
import Link from "next/link";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BranchParametresPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireDashCard: DASH_CARD.PARAMETRES,
  });
  const roles = await listRolesForParametresAction(organizationId, branchId);

  return (
    <div className="flex flex-col gap-4">
      {branch.type === "BOUTIQUE" ? (
        <div className="mx-auto w-full max-w-5xl px-4 pt-4 sm:px-6">
          <Link
            href={boutiqueRoutes.paieParametres(organizationId, branchId)}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Paramètres paie (taux 10 $, semaine, cutoff, avances)
          </Link>
        </div>
      ) : null}
      <ParametresRolesClient
        organizationId={organizationId}
        branchId={branchId}
        initialRoles={roles}
      />
    </div>
  );
}
