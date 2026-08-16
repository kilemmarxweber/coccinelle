import { GuichetForm } from "../../components/guichet-form";
import { GuichetEmpty } from "../../components/guichet-empty";
import { getTrajetsForOrganizationAction } from "../../../trajets/actions";
import { PageHeader } from "@/components/layout/page-header";
import { assertInscriptionPermission } from "@/lib/auth/inscription-permission";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type PageProps = {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ express?: string }>;
};

export default async function GuichetVendrePage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId } = await params;
  const { express: expressParam } = await searchParams;
  const express = expressParam === "1" || expressParam === "true";

  const base = `/admin/organizations/${organizationId}/agences/reservations`;
  const guichetHref = `${base}/guichet`;
  const trajetsHref = `/admin/organizations/${organizationId}/agences/trajets`;

  const sellPerm = await assertInscriptionPermission(organizationId, "ajouter");
  if (!sellPerm.ok) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Vendre" subtitle="Accès refusé" showBack />
        <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle className="text-base">Vente impossible</CardTitle>
              <CardDescription>{sellPerm.message}</CardDescription>
            </CardHeader>
          </Card>
          <div className="mt-4">
            <Button variant="outline" render={<Link href={guichetHref} />}>
              Retour au guichet
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const trajetsResult = await getTrajetsForOrganizationAction(organizationId);

  if (!trajetsResult.ok) {
    return (
      <div className="min-h-screen">
        <PageHeader title="Vendre" subtitle={trajetsResult.message} showBack />
        <div className="mx-auto max-w-2xl px-4 py-8 md:px-6">
          <Button variant="outline" render={<Link href={guichetHref} />}>
            Retour au guichet
          </Button>
        </div>
      </div>
    );
  }

  const hasBookableTrajet = trajetsResult.data.some((t) => t.departs.length > 0);

  if (!hasBookableTrajet) {
    return (
      <div className="min-h-screen">
        <PageHeader
          title="Vendre"
          subtitle="Aucun départ disponible"
          showBack
        />
        <GuichetEmpty
          organizationId={organizationId}
          listHref={base}
          trajetsHref={trajetsHref}
        />
      </div>
    );
  }

  return <GuichetForm organizationId={organizationId} express={express} />;
}
