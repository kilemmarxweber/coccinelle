import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { loadCustomerUiThemeAction } from "@/lib/branch/customer-ui-actions";
import { ParametresShell } from "../parametres-section-nav";
import { CustomerUiApparenceClient } from "./apparence-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BranchParametresApparencePage({
  params,
}: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireDashCard: DASH_CARD.PARAMETRES,
  });
  const { theme } = await loadCustomerUiThemeAction(organizationId, branchId);

  return (
    <ParametresShell
      title="Interface client"
      subtitle="Couleurs de base de l’UI client pour cette branche."
      organizationId={organizationId}
      branchId={branchId}
      active="apparence"
      wide
    >
      <CustomerUiApparenceClient
        organizationId={organizationId}
        branchId={branchId}
        initialTheme={theme}
      />
    </ParametresShell>
  );
}
