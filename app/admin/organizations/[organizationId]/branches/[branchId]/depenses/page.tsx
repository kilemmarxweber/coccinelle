import { requireBranchContext } from "@/lib/branch/require-branch-context";
import {
  getActiveExchangeRate,
  getOpenCashDrawerSummary,
} from "@/lib/cash/actions";
import { listExpensesAction } from "@/lib/purchases/actions";
import { DepensesClient } from "./depenses-client";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function DepensesPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });
  const [expenses, rate, cashDrawer] = await Promise.all([
    listExpensesAction(organizationId, branchId),
    getActiveExchangeRate(branchId),
    getOpenCashDrawerSummary(branchId),
  ]);
  return (
    <DepensesClient
      organizationId={organizationId}
      branchId={branchId}
      branchName={branch.name}
      expenses={expenses}
      rate={rate}
      cashDrawer={cashDrawer}
    />
  );
}
