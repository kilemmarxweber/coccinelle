import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listBranchesAction } from "../../branches/actions";
import { listAssignableOpsRolesAction } from "@/lib/branch/privilege-actions";
import prisma from "@/lib/prisma";
import { CreateMemberForm } from "./create-member-form";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function NewOrganizationMemberPage({ params }: PageProps) {
  const { organizationId } = await params;
  const [org, branchesRes, opsRoles] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { slug: true },
    }),
    listBranchesAction(organizationId),
    listAssignableOpsRolesAction(),
  ]);
  const branches =
    branchesRes.ok
      ? branchesRes.data
          .filter((b) => b.status === "ACTIVE")
          .map((b) => ({
            id: b.id,
            name: b.name,
            code: b.code,
            type: b.type,
          }))
      : [];

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-1 gap-1.5 text-muted-foreground hover:text-foreground"
          render={<Link href={`/admin/organizations/${organizationId}/members`} />}
        >
          <ArrowLeft className="size-4" />
          Liste des membres
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">Nouveau membre</h1>
        <p className="mt-1.5 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Création du compte, rattachement à une ou plusieurs branches, et envoi d’un email avec le
          mot de passe temporaire.
        </p>
      </div>

      <CreateMemberForm
        organizationId={organizationId}
        organizationSlug={org?.slug ?? "org"}
        branches={branches}
        opsRoleOptions={opsRoles.map((r) => ({
          slug: r.slug,
          label: r.label,
        }))}
      />
    </div>
  );
}
