import Link from "next/link";
import { listBranchesAction } from "../../../branches/actions";
import { EditMemberForm } from "./edit-member-form";

type PageProps = { params: Promise<{ organizationId: string; memberId: string }> };

export default async function EditOrganizationMemberPage({ params }: PageProps) {
  const { organizationId, memberId } = await params;
  const branchesRes = await listBranchesAction(organizationId);
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
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Modifier le membre</h1>
        <p className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
          Modifier le rôle, le téléphone WhatsApp, les branches, réinitialiser le mot de passe ou retirer le membre.
        </p>
      </div>

      <EditMemberForm
        organizationId={organizationId}
        memberId={memberId}
        branches={branches}
      />

      <Link
        className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground touch-manipulation hover:bg-muted hover:text-foreground sm:w-fit"
        href={`/admin/organizations/${organizationId}/members`}
      >
        ← Liste des membres
      </Link>
    </div>
  );
}
