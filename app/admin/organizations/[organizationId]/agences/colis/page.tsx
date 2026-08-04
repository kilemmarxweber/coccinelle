import Link from "next/link";
import { Package } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function ColisPage({ params }: PageProps) {
  const { organizationId } = await params;
  const base = `/admin/organizations/${organizationId}/agences`;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Colis"
        subtitle="Envois et destinataires"
        showBack
      />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <EmptyState
          icon={Package}
          title="Gestion colis à venir"
          description="Les colis se créent déjà au guichet (avec destinataire). Le suivi des statuts arrivera dans une prochaine unit."
          action={
            <Button
              render={
                <Link href={`${base}/reservations/guichet/vendre`} />
              }
            >
              Vendre au guichet
            </Button>
          }
        />
      </div>
    </div>
  );
}
