"use client";

import * as React from "react";
import { Package, Truck, Filter, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { Button } from "@/components/ui/button";
import { ListGroup, ListItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDateTimeFr, formatMontantFc, STATUT_COLIS_LABELS } from "@/lib/reservation/labels";
import { useParams, useRouter } from "next/navigation";

export type ColisListItem = {
  id: string;
  codeUnique: string;
  statut: string;
  type: string;
  montantAPayer: number;
  poids: number;
  trajet: {
    villeDepart: string;
    villeArrivee: string;
  };
  trajetDepart?: {
    dateDepart: string | Date;
    heureDepart: string;
  } | null;
  client: {
    user: { name: string | null; email: string };
    prenom: string | null;
    postnom: string | null;
  };
};

type Props = {
  colis: ColisListItem[];
  errorMessage?: string;
};

function clientLabel(r: ColisListItem) {
  const u = r.client.user;
  const parts = [r.client.prenom, u.name?.split(" ")[0], r.client.postnom].filter(Boolean);
  return parts[0] ? parts.join(" ") : u.email;
}

function StatutColisBadge({ statut, className }: { statut: string; className?: string }) {
  const variant = statut === "LIVRE" ? "secondary" : statut === "EXPEDIE" ? "default" : "outline";

  return (
    <Badge
      variant={variant}
      className={cn(
        "text-xs",
        statut === "LIVRE" && "bg-success/15 text-success-foreground border-success/30",
        className
      )}
    >
      {STATUT_COLIS_LABELS[statut] ?? statut}
    </Badge>
  );
}

export function ColisList({ colis, errorMessage }: Props) {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.organizationId as string;
  const base = `/admin/organizations/${organizationId}/agences/colis`;

  const [search, setSearch] = React.useState("");
  const [tab, setTab] = React.useState<"all" | "enCours" | "livre">("all");

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    return colis.filter((item) => {
      if (tab === "enCours" && item.statut !== "EXPEDIE") return false;
      if (tab === "livre" && item.statut !== "LIVRE") return false;

      if (!q) return true;

      const hay = [
        item.codeUnique,
        clientLabel(item),
        item.client.user.email,
        item.trajet.villeDepart,
        item.trajet.villeArrivee,
        item.type,
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(q);
    });
  }, [colis, search, tab]);

  const enCoursCount = colis.filter((item) => item.statut === "EXPEDIE").length;
  const livreCount = colis.filter((item) => item.statut === "LIVRE").length;

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Colis"
        subtitle={
          errorMessage ? errorMessage : `${colis.length} colis${colis.length !== 1 ? "s" : ""}`
        }
        showBack
        actions={[
          {
            label: "Nouvelle",
            onClick: () => router.push(`${base}/nouveau`),
            icon: <Plus className="size-4" />,
          },
        ]}
      />

      <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-4 md:max-w-6xl md:px-6">
        <SearchInput value={search} onChange={setSearch} placeholder="Code, client, trajet…" />

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid h-auto w-full grid-cols-3 p-1">
            <TabsTrigger value="all" className="h-9 text-xs">
              Tous ({colis.length})
            </TabsTrigger>
            <TabsTrigger value="enCours" className="h-9 text-xs">
              En cours ({enCoursCount})
            </TabsTrigger>
            <TabsTrigger value="livre" className="h-9 text-xs">
              Livrés ({livreCount})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {filtered.length === 0 ? (
          <EmptyState
            icon={search || tab !== "all" ? Filter : Package}
            title="Aucun colis"
            description={
              search || tab !== "all"
                ? "Modifiez la recherche ou les filtres."
                : "Aucun colis disponible pour le moment."
            }
            action={
              <Button variant="outline" onClick={() => setSearch("")}>
                Effacer la recherche
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
                    <th className="px-4 py-3 font-medium">Poids</th>
                    <th className="px-4 py-3 font-medium">Montant</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer transition-colors hover:bg-muted/30"
                      onClick={() => router.push(`${base}/${item.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs">{item.codeUnique}</td>
                      <td className="px-4 py-3">{clientLabel(item)}</td>
                      <td className="px-4 py-3">
                        {item.trajet.villeDepart} → {item.trajet.villeArrivee}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.trajetDepart
                          ? formatDateTimeFr(
                              item.trajetDepart.dateDepart,
                              item.trajetDepart.heureDepart
                            )
                          : "N/A"}
                      </td>
                      <td className="px-4 py-3">{item.poids.toFixed(1)} kg</td>
                      <td className="px-4 py-3 font-medium">
                        {formatMontantFc(item.montantAPayer)}
                      </td>
                      <td className="px-4 py-3">
                        <StatutColisBadge statut={item.statut} />
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
              {filtered.map((item) => (
                <ListItem
                  key={item.id}
                  title={item.codeUnique}
                  subtitle={`${item.trajet.villeDepart} → ${item.trajet.villeArrivee}`}
                  description={`${clientLabel(item)} · ${formatMontantFc(item.montantAPayer)}`}
                  href={`${base}/${item.id}`}
                  leading={
                    <div className="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold">
                      {clientLabel(item).slice(0, 2).toUpperCase()}
                    </div>
                  }
                  trailing={
                    <div className="flex flex-col items-end gap-1">
                      <StatutColisBadge statut={item.statut} />
                      <span className="text-muted-foreground text-xs">
                        {item.poids.toFixed(1)} kg
                      </span>
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
