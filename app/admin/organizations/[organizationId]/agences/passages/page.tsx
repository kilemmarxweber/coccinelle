import Link from "next/link";
import { QrCode } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type PageProps = { params: Promise<{ organizationId: string }> };

export default async function EmbarquementPlaceholderPage({
  params,
}: PageProps) {
  const { organizationId } = await params;
  const base = `/admin/organizations/${organizationId}/agences`;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Embarquement"
        subtitle="Scan QR et contrôle des passagers"
        showBack
      />
      <div className="mx-auto max-w-2xl px-4 py-8">
        <EmptyState
          icon={QrCode}
          title="Embarquement à venir"
          description="Le scan QR pour l’embarquement arrivera bientôt. En attendant, gérez les réservations depuis le guichet."
          action={
            <Button render={<Link href={`${base}/reservations`} />}>
              Voir les réservations
            </Button>
          }
        />
      </div>
    </div>
  );
}
