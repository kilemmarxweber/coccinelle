import Link from "next/link";
import {
  SourceReservationBadge,
  StatutPaiementBadge,
  StatutReservationBadge,
} from "@/components/reservation/reservation-badges";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { gerantPath } from "@/lib/agence/routes";
import {
  CATEGORIE_PASSAGER_LABELS,
  formatDateTimeFr,
  formatMontantFc,
  METHODE_PAIEMENT_LABELS,
  MODE_TRANSPORT_LABELS,
} from "@/lib/reservation/labels";

export type GerantReservationDetailData = {
  id: string;
  codeUnique: string;
  statut: string;
  source: string;
  prixBillet: number;
  prixTotal: number;
  nombrePlaces: number;
  dateDepart: string;
  heureDepart: string;
  createdAt: string;
  client: {
    label: string;
    email: string;
    telephone: string;
  };
  trajet: {
    villeDepart: string;
    villeArrivee: string;
    modeTransport: string;
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
    codeUnique: string;
    montant: number;
    methode: string;
    statut: string;
    createdAt: string;
  }>;
};

type GerantReservationDetailViewProps = {
  organizationId: string;
  reservation: GerantReservationDetailData;
};

export function GerantReservationDetailView({
  organizationId,
  reservation: r,
}: GerantReservationDetailViewProps) {
  const listHref = gerantPath(organizationId, "reservations");
  const paiementPrincipal = r.paiements[0];

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={r.codeUnique}
        subtitle={`${r.trajet.villeDepart} → ${r.trajet.villeArrivee}`}
        showBack
      />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-6">
        <div className="flex flex-wrap gap-1.5">
          <StatutReservationBadge statut={r.statut} />
          {paiementPrincipal ? (
            <StatutPaiementBadge statut={paiementPrincipal.statut} />
          ) : null}
          <SourceReservationBadge source={r.source} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Voyage</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p>
                {r.trajet.villeDepart} → {r.trajet.villeArrivee}
              </p>
              <p className="text-muted-foreground">
                {MODE_TRANSPORT_LABELS[r.trajet.modeTransport] ??
                  r.trajet.modeTransport}
              </p>
              <p>{formatDateTimeFr(r.dateDepart, r.heureDepart)}</p>
              <p>
                {r.nombrePlaces} place{r.nombrePlaces !== 1 ? "s" : ""} · billet{" "}
                {formatMontantFc(r.prixBillet)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Client</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <p className="font-medium">{r.client.label}</p>
              <p className="text-muted-foreground">{r.client.email}</p>
              <p className="text-muted-foreground">{r.client.telephone}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Passagers</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {r.passagers.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <div>
                  <p className="font-medium">
                    {p.prenom} {p.nom}
                  </p>
                  <p className="text-muted-foreground">
                    {CATEGORIE_PASSAGER_LABELS[p.categorie] ?? p.categorie} ·{" "}
                    <span className="font-mono text-xs">{p.codeUnique}</span>
                  </p>
                </div>
                <span>{formatMontantFc(p.prix)}</span>
              </div>
            ))}
            {r.passagers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun passager.</p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Paiements</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-lg font-semibold">
              Total {formatMontantFc(r.prixTotal)}
            </p>
            <Separator />
            {r.paiements.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-xs">{p.codeUnique}</span>
                  <span className="text-muted-foreground">
                    {METHODE_PAIEMENT_LABELS[p.methode] ?? p.methode} ·{" "}
                    {formatDateTimeFr(p.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <StatutPaiementBadge statut={p.statut} />
                  <span className="font-medium">
                    {formatMontantFc(p.montant)}
                  </span>
                </div>
              </div>
            ))}
            {r.paiements.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun paiement.</p>
            ) : null}
          </CardContent>
        </Card>

        <Button variant="outline" render={<Link href={listHref} />}>
          Retour à la liste
        </Button>
      </div>
    </div>
  );
}
