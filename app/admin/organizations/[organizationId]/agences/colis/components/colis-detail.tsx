"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ListGroup, ListItem } from "@/components/ui/list-item";
import { toast } from "sonner";
import { formatDateTimeFr, formatMontantFc, STATUT_COLIS_LABELS } from "@/lib/reservation/labels";
import { updateColisAction } from "../actions";

export type ColisDetailData = {
  id: string;
  codeUnique: string;
  statut: string;
  type: string;
  montantAPayer: number;
  poids: number;
  commentaire?: string | null;
  createdAt: string | Date;
  trajet: { villeDepart: string; villeArrivee: string };
  trajetDepart?: { dateDepart: string | Date; heureDepart: string } | null;
  client: {
    user: { name: string | null; email: string };
    prenom?: string | null;
    postnom?: string | null;
  };
};

type Props = { organizationId: string; colis: ColisDetailData };

export function ColisDetail({ organizationId, colis }: Props) {
  const router = useRouter();
  const base = `/admin/organizations/${organizationId}/agences/colis`;
  const [statut, setStatut] = React.useState(colis.statut);
  const [saving, setSaving] = React.useState(false);

  const clientName =
    colis.client.user.name ?? [colis.client.prenom, colis.client.postnom].filter(Boolean).join(" ");

  async function handleSave() {
    if (statut === colis.statut) {
      toast.message("Aucune modification à enregistrer.");
      return;
    }
    setSaving(true);
    const res = await updateColisAction({
      organizationId,
      colisId: colis.id,
      statut: statut as any,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Colis mis à jour.");
    router.refresh();
  }

  const isLivré = colis.statut === "LIVRE";

  return (
    <div className="min-h-screen">
      <PageHeader
        title={colis.codeUnique}
        subtitle={`${colis.trajet.villeDepart} → ${colis.trajet.villeArrivee}`}
        showBack
      />

      <div className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-4 md:max-w-6xl md:grid-cols-[1fr_300px] md:px-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6 min-w-0">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm font-medium">
              {STATUT_COLIS_LABELS[colis.statut] ?? colis.statut}
            </span>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Détails colis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Créé le · </span>
                {formatDateTimeFr(colis.createdAt)}
              </p>
              <p>
                <span className="text-muted-foreground">Poids · </span>
                {colis.poids.toFixed(1)} kg
              </p>
              <p>
                <span className="text-muted-foreground">Montant · </span>
                {formatMontantFc(colis.montantAPayer)}
              </p>
              {colis.commentaire && (
                <p>
                  <span className="text-muted-foreground">Commentaire · </span>
                  {colis.commentaire}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Client</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{clientName}</p>
              <p className="text-muted-foreground">{colis.client.user.email}</p>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 md:sticky md:top-20 md:self-start">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Statut colis</Label>
                <Select
                  className="h-11 w-full"
                  value={statut}
                  onChange={(e) => setStatut(e.target.value)}
                  disabled={isLivré}
                >
                  {(["EN_ATTENTE", "EXPEDIE", "LIVRE"] as const).map((s) => (
                    <option key={s} value={s}>
                      {STATUT_COLIS_LABELS[s] ?? s}
                    </option>
                  ))}
                </Select>
              </div>

              <Button className="w-full h-11" onClick={handleSave} disabled={saving || isLivré}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
