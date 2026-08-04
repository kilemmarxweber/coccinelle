"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bus, Lock, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  createPlanningDepartAction,
  updateDepartCapaciteAction,
  updateDepartStatutAction,
} from "@/app/agence/[orgId]/gerant/planning/actions";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress, ProgressLabel } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type {
  PlanningDepartRow,
  PlanningTrajetOption,
} from "@/lib/planning/list-planning-departs";
import {
  formatDateFr,
  MODE_TRANSPORT_LABELS,
  STATUT_TRAJET_DEPART_LABELS,
} from "@/lib/reservation/labels";

type GerantPlanningViewProps = {
  organizationId: string;
  periodFrom: string;
  periodTo: string;
  departs: PlanningDepartRow[];
  trajets: PlanningTrajetOption[];
  canUpdate: boolean;
  canCancel: boolean;
  canCreate: boolean;
};

function statutBadgeVariant(
  statut: PlanningDepartRow["statut"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (statut) {
    case "OUVERT":
      return "default";
    case "ANNULE":
      return "destructive";
    default:
      return "secondary";
  }
}

export function GerantPlanningView({
  organizationId,
  periodFrom,
  periodTo,
  departs,
  trajets,
  canUpdate,
  canCancel,
  canCreate,
}: GerantPlanningViewProps) {
  const router = useRouter();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [capaciteTarget, setCapaciteTarget] =
    React.useState<PlanningDepartRow | null>(null);
  const [capaciteValue, setCapaciteValue] = React.useState("");
  const [showCreate, setShowCreate] = React.useState(false);
  const [createPending, setCreatePending] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    trajetId: trajets[0]?.id ?? "",
    dateDepart: periodFrom,
    heureDepart: "08:00",
    capacitePlaces: "",
  });

  const readOnly = !canUpdate && !canCancel && !canCreate;

  function navigatePeriod(from: string, to: string) {
    const params = new URLSearchParams({ from, to });
    router.push(`?${params.toString()}`);
  }

  async function handleStatut(
    depart: PlanningDepartRow,
    statut: "PLANIFIE" | "OUVERT" | "ANNULE",
  ) {
    setPendingId(depart.id);
    const res = await updateDepartStatutAction({
      organizationId,
      departId: depart.id,
      statut,
    });
    setPendingId(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    const labels = {
      OUVERT: "Départ ouvert à la réservation.",
      PLANIFIE: "Départ fermé (planifié).",
      ANNULE: "Départ annulé — exclu de la recherche.",
    } as const;
    toast.success(labels[statut]);
    router.refresh();
  }

  async function handleCapaciteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!capaciteTarget) return;
    setPendingId(capaciteTarget.id);
    const res = await updateDepartCapaciteAction({
      organizationId,
      departId: capaciteTarget.id,
      capacitePlaces: capaciteValue,
    });
    setPendingId(null);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success(
      `Capacité mise à jour : ${res.data.placesRestantes} place${res.data.placesRestantes !== 1 ? "s" : ""} restante${res.data.placesRestantes !== 1 ? "s" : ""}.`,
    );
    setCapaciteTarget(null);
    router.refresh();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreatePending(true);
    const res = await createPlanningDepartAction({
      organizationId,
      trajetId: createForm.trajetId,
      dateDepart: createForm.dateDepart,
      heureDepart: createForm.heureDepart,
      capacitePlaces: createForm.capacitePlaces
        ? Number(createForm.capacitePlaces)
        : undefined,
    });
    setCreatePending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Départ créé (planifié). Ouvrez-le pour le rendre réservable.");
    setShowCreate(false);
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Planning"
        subtitle="Départs, capacité et ouverture / fermeture"
        actions={
          canCreate && trajets.length > 0
            ? [
                {
                  label: "Nouveau départ",
                  onClick: () => setShowCreate(true),
                  icon: <Plus data-icon="inline-start" />,
                },
              ]
            : []
        }
      />

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
        {readOnly ? (
          <Alert>
            <Lock />
            <AlertTitle>Lecture seule</AlertTitle>
            <AlertDescription>
              Votre rôle permet de consulter le planning, pas de modifier les
              départs.
            </AlertDescription>
          </Alert>
        ) : null}

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const from = String(fd.get("from") ?? periodFrom);
            const to = String(fd.get("to") ?? periodTo);
            navigatePeriod(from, to);
          }}
        >
          <Field className="w-40">
            <FieldLabel htmlFor="planning-from">Du</FieldLabel>
            <Input
              id="planning-from"
              name="from"
              type="date"
              defaultValue={periodFrom}
              required
            />
          </Field>
          <Field className="w-40">
            <FieldLabel htmlFor="planning-to">Au</FieldLabel>
            <Input
              id="planning-to"
              name="to"
              type="date"
              defaultValue={periodTo}
              required
            />
          </Field>
          <Button type="submit" variant="outline">
            Afficher
          </Button>
        </form>

        {departs.length === 0 ? (
          <EmptyState
            icon={Bus}
            title="Aucun départ sur cette période"
            description={
              trajets.length === 0
                ? "Créez d’abord un trajet, puis ajoutez des départs ici."
                : "Ajustez la période ou créez un nouveau départ."
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            {departs.map((depart) => {
              const busy = pendingId === depart.id;
              return (
                <Card key={depart.id} size="sm">
                  <CardHeader className="border-b">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex flex-col gap-1">
                        <CardTitle>
                          {depart.villeDepart} → {depart.villeArrivee}
                        </CardTitle>
                        <CardDescription>
                          {formatDateFr(depart.dateDepart)} · {depart.heureDepart}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">
                          {MODE_TRANSPORT_LABELS[depart.modeTransport]}
                        </Badge>
                        <Badge variant={statutBadgeVariant(depart.statut)}>
                          {STATUT_TRAJET_DEPART_LABELS[depart.statut] ??
                            depart.statut}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-4 pt-4">
                    <Progress
                      value={depart.remplissagePct}
                      className="w-full"
                    >
                      <ProgressLabel>Remplissage</ProgressLabel>
                      <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                        {depart.placesOccupees}/{depart.capacitePlaces} (
                        {depart.remplissagePct} %) · {depart.placesRestantes}{" "}
                        restante
                        {depart.placesRestantes !== 1 ? "s" : ""}
                      </span>
                    </Progress>

                    {canUpdate || canCancel ? (
                      <div className="flex flex-wrap gap-2">
                        {canUpdate && depart.statut === "PLANIFIE" ? (
                          <Button
                            type="button"
                            size="sm"
                            disabled={busy}
                            onClick={() => handleStatut(depart, "OUVERT")}
                          >
                            {busy ? <Spinner data-icon="inline-start" /> : null}
                            Ouvrir
                          </Button>
                        ) : null}
                        {canUpdate && depart.statut === "OUVERT" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => handleStatut(depart, "PLANIFIE")}
                          >
                            {busy ? <Spinner data-icon="inline-start" /> : null}
                            Fermer
                          </Button>
                        ) : null}
                        {canUpdate && depart.statut !== "ANNULE" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                              setCapaciteTarget(depart);
                              setCapaciteValue(String(depart.capacitePlaces));
                            }}
                          >
                            Capacité
                          </Button>
                        ) : null}
                        {canCancel && depart.statut !== "ANNULE" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={busy}
                            onClick={() => handleStatut(depart, "ANNULE")}
                          >
                            {busy ? <Spinner data-icon="inline-start" /> : null}
                            Annuler
                          </Button>
                        ) : null}
                        {canUpdate && depart.statut === "ANNULE" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => handleStatut(depart, "PLANIFIE")}
                          >
                            Restaurer (planifié)
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog
        open={capaciteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setCapaciteTarget(null);
        }}
      >
        <DialogContent>
          <form onSubmit={handleCapaciteSubmit}>
            <DialogHeader>
              <DialogTitle>Modifier la capacité</DialogTitle>
              <DialogDescription>
                {capaciteTarget
                  ? `${capaciteTarget.villeDepart} → ${capaciteTarget.villeArrivee} · ${capaciteTarget.placesOccupees} place${capaciteTarget.placesOccupees !== 1 ? "s" : ""} déjà vendue${capaciteTarget.placesOccupees !== 1 ? "s" : ""}.`
                  : null}
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="mt-4">
              <Field>
                <FieldLabel htmlFor="capacite-places">
                  Capacité (places)
                </FieldLabel>
                <Input
                  id="capacite-places"
                  type="number"
                  min={capaciteTarget?.placesOccupees ?? 1}
                  required
                  value={capaciteValue}
                  onChange={(e) => setCapaciteValue(e.target.value)}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCapaciteTarget(null)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={pendingId === capaciteTarget?.id}>
                {pendingId === capaciteTarget?.id ? (
                  <Spinner data-icon="inline-start" />
                ) : null}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Nouveau départ</DialogTitle>
              <DialogDescription>
                Créé en statut planifié — ouvrez-le ensuite pour la vente.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="mt-4">
              <Field>
                <FieldLabel htmlFor="create-trajet">Trajet</FieldLabel>
                <Select
                  id="create-trajet"
                  required
                  value={createForm.trajetId}
                  onChange={(e) =>
                    setCreateForm((f) => ({ ...f, trajetId: e.target.value }))
                  }
                >
                  {trajets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} ({MODE_TRANSPORT_LABELS[t.modeTransport]})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="create-date">Date</FieldLabel>
                <Input
                  id="create-date"
                  type="date"
                  required
                  value={createForm.dateDepart}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      dateDepart: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="create-heure">Heure</FieldLabel>
                <Input
                  id="create-heure"
                  type="time"
                  required
                  value={createForm.heureDepart}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      heureDepart: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="create-capacite">
                  Capacité (optionnel)
                </FieldLabel>
                <Input
                  id="create-capacite"
                  type="number"
                  min={1}
                  placeholder="Défaut selon bus / avion"
                  value={createForm.capacitePlaces}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      capacitePlaces: e.target.value,
                    }))
                  }
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCreate(false)}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={createPending || !createForm.trajetId}>
                {createPending ? <Spinner data-icon="inline-start" /> : null}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
