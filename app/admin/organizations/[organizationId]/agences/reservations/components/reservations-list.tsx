"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Filter, Plus, Ticket } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { ListGroup, ListItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  formatDateTimeFr,
  formatMontantFc,
} from "@/lib/reservation/labels";
import {
  SourceReservationBadge,
  StatutPaiementBadge,
  StatutReservationBadge,
} from "./reservation-badges";

export type ReservationListItem = {
  id: string;
  codeUnique: string;
  statut: string;
  source: string;
  prixTotal: number;
  nombrePlaces: number;
  dateDepart: string | Date;
  heureDepart: string;
  createdAt: string | Date;
  client: {
    user: { name: string | null; email: string };
    prenom: string | null;
    postnom: string | null;
  };
  trajet: {
    villeDepart: string;
    villeArrivee: string;
  };
  paiements: Array<{ statut: string }>;
};

type Props = {
  reservations: ReservationListItem[];
  errorMessage?: string;
};

function clientLabel(r: ReservationListItem) {
  const u = r.client.user;
  const parts = [r.client.prenom, u.name?.split(" ")[0], r.client.postnom].filter(Boolean);
  return parts[0] ? parts.join(" ") : u.email;
}

function paiementStatut(r: ReservationListItem) {
  return r.paiements[0]?.statut ?? "EN_ATTENTE";
}

export function ReservationsList({ reservations, errorMessage }: Props) {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.organizationId as string;
  const base = `/admin/organizations/${organizationId}/agences/reservations`;

  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState<"all" | "pending" | "paid">("all");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return reservations.filter((r) => {
      const pay = paiementStatut(r);
      if (tab === "pending" && pay !== "EN_ATTENTE") return false;
      if (tab === "paid" && pay !== "PAYE") return false;
      if (!q) return true;
      const hay = [
        r.codeUnique,
        clientLabel(r),
        r.client.user.email,
        r.trajet.villeDepart,
        r.trajet.villeArrivee,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [reservations, search, tab]);

  const pendingCount = reservations.filter(
    (r) => paiementStatut(r) === "EN_ATTENTE",
  ).length;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Réservations"
        subtitle={
          errorMessage
            ? errorMessage
            : `${reservations.length} réservation${reservations.length !== 1 ? "s" : ""}`
        }
        showBack
        actions={[
          {
            label: "Nouvelle",
            onClick: () => router.push(`${base}/guichet`),
            icon: <Plus className="size-4" />,
          },
        ]}
      />

      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4 md:max-w-6xl md:px-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Code, client, trajet…"
        />

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid h-auto w-full grid-cols-3 p-1">
            <TabsTrigger value="all" className="h-9 text-xs">
              Toutes ({reservations.length})
            </TabsTrigger>
            <TabsTrigger value="pending" className="h-9 text-xs">
              Paiement ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="paid" className="h-9 text-xs">
              Payées
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <EmptyState
            icon={search || tab !== "all" ? Filter : Ticket}
            title="Aucune réservation"
            description={
              search || tab !== "all"
                ? "Modifiez la recherche ou les filtres."
                : "Créez une réservation au guichet pour commencer."
            }
            action={
              <Button render={<Link href={`${base}/guichet`} />}>
                <Plus className="size-4" />
                Nouvelle réservation
              </Button>
            }
          />
        ) : (
          <div className="hidden md:block">
            <div className="overflow-hidden rounded-xl border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Client</th>
                    <th className="px-4 py-3 font-medium">Trajet</th>
                    <th className="px-4 py-3 font-medium">Départ</th>
                    <th className="px-4 py-3 font-medium">Montant</th>
                    <th className="px-4 py-3 font-medium">Statuts</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((r) => (
                    <tr
                      key={r.id}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => router.push(`${base}/${r.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{r.codeUnique}</td>
                      <td className="px-4 py-3">{clientLabel(r)}</td>
                      <td className="px-4 py-3">
                        {r.trajet.villeDepart} → {r.trajet.villeArrivee}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDateTimeFr(r.dateDepart, r.heureDepart)}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {formatMontantFc(r.prixTotal)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          <StatutReservationBadge statut={r.statut} />
                          <StatutPaiementBadge statut={paiementStatut(r)} />
                          <SourceReservationBadge source={r.source} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="md:hidden">
            <ListGroup>
              {filtered.map((r) => (
                <ListItem
                  key={r.id}
                  title={r.codeUnique}
                  subtitle={`${r.trajet.villeDepart} → ${r.trajet.villeArrivee}`}
                  description={`${clientLabel(r)} · ${formatMontantFc(r.prixTotal)}`}
                  href={`${base}/${r.id}`}
                  leading={
                    <Avatar className="size-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs">
                        {clientLabel(r).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <StatutPaiementBadge statut={paiementStatut(r)} />
                      <StatutReservationBadge statut={r.statut} />
                    </div>
                  }
                />
              ))}
            </ListGroup>
          </div>
        )}
      </div>
    </div>
  );
}
