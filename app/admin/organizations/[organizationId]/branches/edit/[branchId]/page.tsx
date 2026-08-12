import Link from "next/link";
import { notFound } from "next/navigation";
import { getBranchAction } from "../../actions";
import { EditBranchForm } from "./edit-branch-form";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function EditBranchPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const res = await getBranchAction(organizationId, branchId);
  if (!res.ok) {
    if (res.message === "Branche introuvable.") notFound();
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <p className="text-sm text-destructive">{res.message}</p>
        <Link
          className="mt-4 inline-flex text-sm text-muted-foreground hover:text-foreground"
          href={`/admin/organizations/${organizationId}/branches`}
        >
          ← Liste des branches
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Modifier la branche
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Mettez à jour l’identité, le statut et les modules métier de «{" "}
          {res.data.name} ».
        </p>
      </div>

      <EditBranchForm organizationId={organizationId} branch={res.data} />

      <Link
        className="inline-flex h-11 items-center text-sm font-medium text-muted-foreground hover:text-foreground"
        href={`/admin/organizations/${organizationId}/branches`}
      >
        ← Liste des branches
      </Link>
    </div>
  );
}
