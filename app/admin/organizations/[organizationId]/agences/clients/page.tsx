import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function ClientsPage({ params }: PageProps) {
  const { organizationId } = await params;
  const base = `/admin/organizations/${organizationId}/agences`;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Clients"
        subtitle="Profils voyageurs de l’agence"
        showBack
      />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <EmptyState
          icon={Users}
          title="Liste clients à brancher"
          description="Les clients créés au guichet sont déjà utilisables pour les réservations. Une fiche dédiée arrivera plus tard."
          action={
            <Button render={<Link href={`${base}/reservations/guichet`} />}>
              Aller au guichet
            </Button>
          }
        />
      </div>
    </div>
  );
}
