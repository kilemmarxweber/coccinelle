"use client";

import Link from "next/link";
import { QrCode, Ticket, Zap } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ListGroup, ListItem } from "@/components/ui/list-item";
import {
  formatDateTimeFr,
  formatMontantFc,
} from "@/lib/reservation/labels";
import {
  SourceReservationBadge,
  StatutPaiementBadge,
  StatutReservationBadge,
} from "./reservation-badges";
import type { ReservationListItem } from "./reservations-list";

type Props = {
  organizationId: string;
  canSell: boolean;
  denyMessage?: string;
  lastSales: ReservationListItem[];
};

function clientLabel(r: ReservationListItem) {
  const u = r.client.user;
  const parts = [r.client.prenom, u.name?.split(" ")[0], r.client.postnom].filter(
    Boolean,
  );
  return parts[0] ? parts.join(" ") : u.email;
}

function paiementStatut(r: ReservationListItem) {
  return r.paiements[0]?.statut ?? "EN_ATTENTE";
}

export function GuichetHome({
  organizationId,
  canSell,
  denyMessage,
  lastSales,
}: Props) {
  const base = `/admin/organizations/${organizationId}/agences/reservations`;
  const agenceBase = `/admin/organizations/${organizationId}/agences`;
  const vendreHref = `${base}/guichet/vendre`;
  const expressHref = `${base}/guichet/vendre?express=1`;
  const embarquementHref = `${agenceBase}/passages`;

  return (
    <div className="min-h-screen pb-10">
      <PageHeader
        title="Guichet"
        subtitle="Vente comptoir — funnel accéléré"
        showBack
      />

      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:max-w-4xl md:px-6">
        {!canSell && (
          <Card className="border-destructive/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Accès vente refusé</CardTitle>
              <CardDescription>
                {denyMessage ??
                  "Permission inscription:ajouter requise (rôle guichetier ou owner)."}
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            className="h-12 flex-1"
            disabled={!canSell}
            render={canSell ? <Link href={vendreHref} /> : undefined}
          >
            <Ticket data-icon="inline-start" aria-hidden />
            Vendre
          </Button>
          <Button
            className="h-12 flex-1"
            variant="secondary"
            disabled={!canSell}
            render={canSell ? <Link href={expressHref} /> : undefined}
          >
            <Zap data-icon="inline-start" aria-hidden />
            Vente express
          </Button>
          <Button
            className="h-12 flex-1"
            variant="outline"
            render={<Link href={embarquementHref} />}
          >
            <QrCode data-icon="inline-start" aria-hidden />
            Embarquement
          </Button>
        </div>

        <section className="flex flex-col gap-3" aria-labelledby="last-sales">
          <div className="flex items-center justify-between gap-2">
            <h2 id="last-sales" className="text-lg font-semibold">
              5 dernières ventes
            </h2>
            <Button variant="ghost" size="sm" render={<Link href={base} />}>
              Toutes
            </Button>
          </div>

          {lastSales.length === 0 ? (
            <Card>
              <CardContent className="pt-0">
                <EmptyState
                  icon={Ticket}
                  title="Aucune vente récente"
                  description="Les réservations créées au guichet apparaîtront ici."
                />
              </CardContent>
            </Card>
          ) : (
            <ListGroup>
              {lastSales.map((r) => (
                <ListItem
                  key={r.id}
                  href={`${base}/${r.id}`}
                  title={r.codeUnique}
                  subtitle={`${clientLabel(r)} · ${formatMontantFc(r.prixTotal)}`}
                  description={`${r.trajet.villeDepart} → ${r.trajet.villeArrivee} · ${formatDateTimeFr(r.createdAt)}`}
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <StatutReservationBadge statut={r.statut} />
                      <StatutPaiementBadge statut={paiementStatut(r)} />
                      <SourceReservationBadge source={r.source} />
                    </div>
                  }
                />
              ))}
            </ListGroup>
          )}
        </section>
      </div>
    </div>
  );
}
