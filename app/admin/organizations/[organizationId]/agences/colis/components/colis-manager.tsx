"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Package, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatMontantFc } from "@/lib/reservation/labels";
import { cn } from "@/lib/utils";
import {
  advanceColisStatutAction,
} from "../actions";
import {
  COLIS_STATUTS,
  type ColisListItem,
  type ColisStatut,
} from "../colis-shared";

const STATUT_LABELS: Record<ColisStatut, string> = {
  EN_ATTENTE: "En attente",
  EXPEDIE: "Expédié",
  LIVRE: "Livré",
};

const NEXT_LABEL: Partial<Record<ColisStatut, string>> = {
  EN_ATTENTE: "Marquer expédié",
  EXPEDIE: "Marquer livré",
};

type Props = {
  organizationId: string;
  canRead: boolean;
  canUpdate: boolean;
  denyMessage?: string;
  initialItems: ColisListItem[];
};

export function ColisManager({
  organizationId,
  canRead,
  canUpdate,
  denyMessage,
  initialItems,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [statutFilter, setStatutFilter] = useState<string>("ALL");
  const [pending, startTransition] = useTransition();
  const base = `/admin/organizations/${organizationId}/agences`;

  const filtered = useMemo(() => {
    if (statutFilter === "ALL") return items;
    return items.filter((c) => c.statut === statutFilter);
  }, [items, statutFilter]);

  function advance(colisId: string) {
    startTransition(async () => {
      const res = await advanceColisStatutAction({ organizationId, colisId });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setItems((prev) =>
        prev.map((c) => (c.id === colisId ? { ...c, statut: res.statut } : c)),
      );
      toast.success(`Statut → ${STATUT_LABELS[res.statut]}`);
    });
  }

  if (!canRead) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base">Accès colis refusé</CardTitle>
            <CardDescription>
              {denyMessage ??
                "Permission inscription:share requise (guichetier, gérant ou owner)."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 md:px-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtres</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-2">
            <Label htmlFor="colis-statut">Statut</Label>
            <Select
              id="colis-statut"
              value={statutFilter}
              onChange={(e) => setStatutFilter(e.target.value)}
            >
              <option value="ALL">Tous</option>
              {COLIS_STATUTS.map((s) => (
                <option key={s} value={s}>
                  {STATUT_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-sm text-muted-foreground sm:pb-2">
            {filtered.length} colis
          </p>
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Aucun colis"
          description="Les colis créés au guichet ou en ligne apparaîtront ici."
          action={
            <Button render={<Link href={`${base}/reservations/guichet/vendre`} />}>
              Vendre au guichet
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{c.codeUnique}</p>
                    <StatutBadge statut={c.statut} />
                    <Badge variant="outline">{c.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {c.trajet.villeDepart} → {c.trajet.villeArrivee} · {c.poids} kg ·{" "}
                    {formatMontantFc(c.montantAPayer)}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Destinataire :</span>{" "}
                    {c.destinataireNom?.trim() || "—"}
                    {c.destinataireTel ? ` · ${c.destinataireTel}` : ""}
                    {c.destinataireId ? ` · ID ${c.destinataireId}` : ""}
                  </p>
                  {c.reservationCode && c.reservationId ? (
                    <Link
                      href={`${base}/reservations/${c.reservationId}`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Réservation {c.reservationCode}
                    </Link>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-2">
                  {NEXT_LABEL[c.statut] && canUpdate ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => advance(c.id)}
                    >
                      <Truck className="size-3.5" />
                      {NEXT_LABEL[c.statut]}
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatutBadge({ statut }: { statut: ColisStatut }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        statut === "EN_ATTENTE" && "text-amber-600",
        statut === "EXPEDIE" && "text-sky-600",
        statut === "LIVRE" && "text-emerald-600",
      )}
    >
      {STATUT_LABELS[statut]}
    </Badge>
  );
}
