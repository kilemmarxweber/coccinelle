import { redirect } from "next/navigation";

type PageProps = {
  params: Promise<{ organizationId: string; id: string }>;
};

/** Ancienne fiche client — redirige vers la liste. */
export default async function ClientDetailRedirect({ params }: PageProps) {
  const { organizationId } = await params;
  redirect(
    `/admin/organizations/${organizationId}/agences/clients`,
  );
}
