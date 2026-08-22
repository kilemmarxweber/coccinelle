import type { Metadata } from "next";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { canAccessBranch } from "@/lib/branch/user-branches";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { getBranchRoleDashboardAction } from "@/lib/branch/dashboard-actions";
import { BranchDashboard } from "./branch-dashboard";
import { UsineDashboard } from "./usine-dashboard";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { organizationId, branchId } = await params;
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    return { title: "Branche — Coccinelle" };
  }
  const branch = await canAccessBranch(
    session.user.id,
    session.user.role,
    branchId,
  );
  if (!branch || branch.organizationId !== organizationId) {
    return { title: "Branche introuvable" };
  }
  return {
    title: `${branch.name} — Coccinelle`,
    description: `Espace de gestion — ${branch.name}`,
  };
}

export default async function BranchDashboardPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({ organizationId, branchId });
  const data = await getBranchRoleDashboardAction(organizationId, branchId);
  const firstName = data.userName.split(/\s+/)[0] ?? data.userName;
  const now = new Date();
  const hour = now.getHours();
  const greetingText =
    hour < 12
      ? `Bonjour, ${firstName}`
      : hour < 18
        ? `Bon après-midi, ${firstName}`
        : `Bonsoir, ${firstName}`;
  const dateText = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const dashProps = {
    organizationId,
    branchId,
    data,
    greetingText,
    dateText,
  };

  if (data.branchType === "USINE") {
    return <UsineDashboard {...dashProps} />;
  }

  return <BranchDashboard {...dashProps} />;
}
