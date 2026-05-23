"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ListGroup, ListItem } from "@/components/ui/list-item";
import {
  formatDateTimeFr,
  formatMontantFc,
  METHODE_PAIEMENT_LABELS,
  CATEGORIE_PASSAGER_LABELS,
  STATUT_PAIEMENT_LABELS,
  STATUT_RESERVATION_LABELS,
} from "@/lib/reservation/labels";
import {
  deleteReservationAction,
  updateReservationAction,
} from "../actions";
import {
  SourceReservationBadge,
  StatutPaiementBadge,
  StatutReservationBadge,
} from "./reservation-badges";

export type ReservationDetailData = {
  id: string;
  codeUnique: string;
  statut: string;
  source: string;
  prixBillet: number;
  prixTotal: number;
  nombrePlaces: number;
  penalite: number | null;
  peutReporter: boolean;
  dateLimiteReport: string | Date | null;
  dateDepart: string | Date;
  heureDepart: string;
  createdAt: string | Date;
  client: {
    user: { name: string | null; email: string };
    telephone: string;
    prenom: string | null;
    postnom: string | null;
  };
  trajet: {
    villeDepart: string;
    villeArrivee: string;
  };
  passagers: Array<{
    id: string;
    nom: string;
    prenom: string;
    categorie: string;
    prix: number;
    codeUnique: string;
  }>;
  paiements: Array<{
    id: string;
    statut: string;
    methode: string;
    montant: number;
    codeUnique: string;
  }>;
};

type Props = {
  organizationId: string;
  reservation: ReservationDetailData;
};

export function ReservationDetail({ organizationId, reservation }: Props) {
  const router = useRouter();
  const base = `/admin/organizations/${organizationId}/agences/reservations`;
  const [statut, setStatut] = React.useState(reservation.statut);
  const [statutPaiement, setStatutPaiement] = React.useState(
    reservation.paiements[0]?.statut ?? "EN_ATTENTE",
  );
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const clientName =
    reservation.client.user.name ??
    [reservation.client.prenom, reservation.client.postnom].filter(Boolean).join(" ");

  async function handleSave() {
    const payChanged = statutPaiement !== reservation.paiements[0]?.statut;
    const statutChanged = statut !== reservation.statut;
    if (!payChanged && !statutChanged) {
      toast.message("Aucune modification à enregistrer.");
      return;
    }

    setSaving(true);
    const res = await updateReservationAction({
      organizationId,
      reservationId: reservation.id,
      statut: statutChanged ? (statut as typeof reservation.statut) : undefined,
      statutPaiement: payChanged
        ? (statutPaiement as "EN_ATTENTE" | "PAYE" | "ECHOUE")
        : undefined,
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Réservation mise à jour.");
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Supprimer définitivement cette réservation ?")) return;
    setDeleting(true);
    const res = await deleteReservationAction({ organizationId, reservationId: reservation.id });
    setDeleting(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Réservation supprimée.");
    router.push(base);
    router.refresh();
  }

  const paiement = reservation.paiements[0];

  return (
    <div className="min-h-screen">
      <PageHeader
        title={reservation.codeUnique}
        subtitle={`${reservation.trajet.villeDepart} → ${reservation.trajet.villeArrivee}`}
        showBack
      />

      <div className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-4 md:max-w-6xl md:grid-cols-[1fr_300px] md:px-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6 min-w-0">
          <div className="flex flex-wrap gap-2">
            <StatutReservationBadge statut={reservation.statut} />
            {paiement && <StatutPaiementBadge statut={paiement.statut} />}
            <SourceReservationBadge source={reservation.source} />
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Voyage</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Départ · </span>
                {formatDateTimeFr(reservation.dateDepart, reservation.heureDepart)}
              </p>
              <p>
                <span className="text-muted-foreground">Places · </span>
                {reservation.nombrePlaces}
              </p>
              <p>
                <span className="text-muted-foreground">Créée le · </span>
                {formatDateTimeFr(reservation.createdAt)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Client</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p className="font-medium">{clientName}</p>
              <p className="text-muted-foreground">{reservation.client.user.email}</p>
              <p className="text-muted-foreground">{reservation.client.telephone}</p>
            </CardContent>
          </Card>

          {reservation.passagers.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Passagers
              </h2>
              <ListGroup>
                {reservation.passagers.map((p) => (
                  <ListItem
                    key={p.id}
                    title={`${p.prenom} ${p.nom}`}
                    description={`${CATEGORIE_PASSAGER_LABELS[p.categorie] ?? p.categorie} · ${p.codeUnique}`}
                    trailing={
                      <span className="text-sm font-medium">
                        {formatMontantFc(p.prix)}
                      </span>
                    }
                    showChevron={false}
                  />
                ))}
              </ListGroup>
            </section>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Montants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Billets</span>
                <span>{formatMontantFc(reservation.prixBillet)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span>Total</span>
                <span>{formatMontantFc(reservation.prixTotal)}</span>
              </div>
              {paiement && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Paiement</span>
                    <span>
                      {METHODE_PAIEMENT_LABELS[paiement.methode] ?? paiement.methode} ·{" "}
                      {formatMontantFc(paiement.montant)}
                    </span>
                  </div>
                </>
              )}
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
                <Label>Statut réservation</Label>
                <Select
                  className="h-11 w-full"
                  value={statut}
                  onChange={(e) => setStatut(e.target.value)}
                >
                  {(
                    ["CONFIRME", "EMBARQUE", "RATE", "REPORTE", "ANNULE"] as const
                  ).map((s) => (
                    <option key={s} value={s}>
                      {STATUT_RESERVATION_LABELS[s] ?? s}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Statut paiement</Label>
                <Select
                  className="h-11 w-full"
                  value={statutPaiement}
                  onChange={(e) => setStatutPaiement(e.target.value)}
                >
                  {(["EN_ATTENTE", "PAYE", "ECHOUE"] as const).map((s) => (
                    <option key={s} value={s}>
                      {STATUT_PAIEMENT_LABELS[s] ?? s}
                    </option>
                  ))}
                </Select>
              </div>
              <Button
                className="w-full h-11"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Enregistrement…" : "Enregistrer"}
              </Button>
              <Button
                variant="destructive"
                className="w-full h-11 gap-2"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="size-4" />
                {deleting ? "Suppression…" : "Supprimer"}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
