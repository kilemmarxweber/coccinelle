import { headers } from "next/headers";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { resolveCurrentBranchOpsRole } from "@/lib/branch/resolve-ops-role";
import { capabilitiesFromOpsRole, findBranchMemberForUser, getPayslip } from "@/lib/payroll/service";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { BulletinView } from "./bulletin-view";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string; payslipId: string }>;
};

export default async function BulletinPage({ params }: PageProps) {
  const { organizationId, branchId, payslipId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "boutique",
  });
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/auth/sign-in");
  const opsRole = await resolveCurrentBranchOpsRole(organizationId, branchId);
  const caps = capabilitiesFromOpsRole(opsRole);
  const self = await findBranchMemberForUser(branchId, session.user.id);
  try {
    const data = await getPayslip({
      branchId,
      payslipId,
      onlyMemberId: caps.canManage ? undefined : self?.id,
    });
    return <BulletinView data={data} />;
  } catch {
    notFound();
  }
}
