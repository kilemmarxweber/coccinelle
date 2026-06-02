import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ColisDetail } from "../components/colis-detail";
import { getColisDetailAction } from "../actions";

/** Segments réservés (ne sont pas des ids de colis). */
const RESERVED_SEGMENTS = new Set(["nouveau", "new", "create"]);

type PageProps = {
  params: Promise<{ organizationId: string; colisId: string }>;
};

export default async function ColisDetailPage({ params }: PageProps) {
  const { organizationId, colisId } = await params;

  if (RESERVED_SEGMENTS.has(colisId)) {
    redirect(`/admin/organizations/${organizationId}/agences/colis/nouveau`);
  }

  const result = await getColisDetailAction(organizationId, colisId);

  if (!result.ok) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Colis" subtitle={result.message} showBack />
        <div className="mx-auto max-w-2xl px-4 py-8 md:max-w-4xl md:px-6">
          <Button
            variant="outline"
            render={<Link href={`/admin/organizations/${organizationId}/agences/colis`} />}
          >
            Retour aux colis
          </Button>
        </div>
      </div>
    );
  }

  const c = result.data;
  const colis = {
    id: c.id,
    codeUnique: c.codeUnique,
    statut: c.statut,
    type: c.type,
    montantAPayer: c.montantAPayer,
    poids: c.poids,
    commentaire: c.commentaire,
    createdAt: c.createdAt.toISOString(),
    trajet: c.trajet,
    trajetDepart: c.trajetDepart
      ? { ...c.trajetDepart, dateDepart: c.trajetDepart.dateDepart.toISOString() }
      : null,
    client: {
      user: c.client.user,
      prenom: c.client.prenom,
      postnom: c.client.postnom,
    },
  };

  return <ColisDetail organizationId={organizationId} colis={colis} />;
}
