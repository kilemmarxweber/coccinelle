import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { auth } from "@/lib/auth";
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
  const branch = await requireBranchContext({
    organizationId,
    branchId,
    requireDashCard: DASH_CARD.DEPENSES,
  });
  const sessionAuth = await auth.api.getSession({ headers: await headers() });
  const userId = sessionAuth?.user?.id;
  if (!userId) redirect("/auth/sign-in");

  const [expenses, rate, cashDrawer] = await Promise.all([
    listExpensesAction(organizationId, branchId),
    getActiveExchangeRate(branchId),
    getOpenCashDrawerSummary(branchId, userId),
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
