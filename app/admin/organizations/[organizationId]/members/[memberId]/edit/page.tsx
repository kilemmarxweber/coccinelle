import Link from "next/link";
import { EditMemberForm } from "./edit-member-form";

type PageProps = { params: Promise<{ organizationId: string; memberId: string }> };

export default async function EditOrganizationMemberPage({ params }: PageProps) {
  const { organizationId, memberId } = await params;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-8 md:max-w-4xl md:px-6">
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
        Modifier le rôle du membre ou le retirer de l’organisation.
      </p>

      <EditMemberForm organizationId={organizationId} memberId={memberId} />

      <Link
        className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground touch-manipulation hover:bg-muted hover:text-foreground sm:w-fit"
        href={`/admin/organizations/${organizationId}/members`}
      >
        ← Liste des membres
      </Link>
    </div>
  );
}
