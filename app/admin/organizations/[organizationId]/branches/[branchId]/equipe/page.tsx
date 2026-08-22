import { redirect } from "next/navigation";
import { sharedBranchRoutes } from "@/lib/branch/paths";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function BranchEquipePage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  redirect(sharedBranchRoutes.parametresUsers(organizationId, branchId));
}
