import Link from "next/link";
import { CreateMemberForm } from "./create-member-form";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function NewOrganizationMemberPage({ params }: PageProps) {
  const { organizationId } = await params;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-8 md:max-w-4xl md:px-6">
      <div className="space-y-1.5">
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          Création du compte (email + mot de passe généré côté serveur), ajout immédiat à
          l’organisation, et envoi d’un email de confirmation avec le mot de passe temporaire
          (configurez `EMAIL_USER` et `EMAIL_PASS` pour l’envoi réel via SMTP).
        </p>
      </div>

      <CreateMemberForm organizationId={organizationId} />

      <Link
        className="inline-flex h-11 min-h-[44px] items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground touch-manipulation hover:bg-muted hover:text-foreground sm:w-fit"
        href={`/admin/organizations/${organizationId}/members`}
      >
        ← Liste des membres
      </Link>
    </div>
  );
}
