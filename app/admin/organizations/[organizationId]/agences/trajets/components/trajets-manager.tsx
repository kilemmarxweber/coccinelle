"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ListGroup, ListItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateFr, formatMontantFc } from "@/lib/reservation/labels";
import {
  createTrajetAction,
  createTrajetDepartAction,
  provisionDemoTrajetsAction,
} from "../actions";

export type TrajetRow = {
  id: string;
  villeDepart: string;
  villeArrivee: string;
  prixBase: number;
  prixParKilo: number;
  kilosGratuits: number;
  departsCount: number;
  departs: Array<{
    id: string;
    dateDepart: string;
    heureDepart: string;
    statut: string;
  }>;
};

type Props = {
  organizationId: string;
  trajets: TrajetRow[];
  guichetHref: string;
};

export function TrajetsManager({ organizationId, trajets, guichetHref }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState({
    villeDepart: "",
    villeArrivee: "",
    prixBase: "120000",
    prixParKilo: "8",
    kilosGratuits: "30",
  });

  async function handleCreateTrajet(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    const res = await createTrajetAction({
      organizationId,
      villeDepart: form.villeDepart,
      villeArrivee: form.villeArrivee,
      prixBase: form.prixBase,
      prixParKilo: form.prixParKilo,
      kilosGratuits: form.kilosGratuits,
    });
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Trajet créé. Ajoutez un départ ci-dessous.");
    setShowForm(false);
    router.refresh();
  }

  async function handleAddDepart(trajetId: string) {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    const res = await createTrajetDepartAction({
      organizationId,
      trajetId,
      dateDepart: date.toISOString().slice(0, 10),
      heureDepart: "08:00",
    });
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Départ ajouté (dans 7 jours, 08:00).");
    router.refresh();
  }

  async function handleDemo() {
    setPending(true);
    const res = await provisionDemoTrajetsAction(organizationId);
    setPending(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }
    toast.success("Trajets de démo créés.");
    router.refresh();
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Trajets"
        subtitle={`${trajets.length} ligne${trajets.length !== 1 ? "s" : ""}`}
        showBack
        actions={[
          {
            label: "Nouveau",
            onClick: () => setShowForm((v) => !v),
            icon: <Plus className="size-4" />,
          },
        ]}
      />

      <div className="mx-auto max-w-2xl space-y-6 px-4 py-4 md:max-w-4xl md:px-6">
        {showForm && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Nouveau trajet</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateTrajet} className="grid gap-4 sm:grid-cols-2">
                <Field label="Départ">
                  <Input
                    className="h-11"
                    value={form.villeDepart}
                    onChange={(e) => setForm((s) => ({ ...s, villeDepart: e.target.value }))}
                    required
                  />
                </Field>
                <Field label="Arrivée">
                  <Input
                    className="h-11"
                    value={form.villeArrivee}
                    onChange={(e) => setForm((s) => ({ ...s, villeArrivee: e.target.value }))}
                    required
                  />
                </Field>
                <Field label="Prix base (FC)">
                  <Input
                    type="number"
                    className="h-11"
                    value={form.prixBase}
                    onChange={(e) => setForm((s) => ({ ...s, prixBase: e.target.value }))}
                  />
                </Field>
                <Field label="Prix / kg (FC)">
                  <Input
                    type="number"
                    className="h-11"
                    value={form.prixParKilo}
                    onChange={(e) => setForm((s) => ({ ...s, prixParKilo: e.target.value }))}
                  />
                </Field>
                <Field label="Kilos gratuits">
                  <Input
                    type="number"
                    className="h-11"
                    value={form.kilosGratuits}
                    onChange={(e) => setForm((s) => ({ ...s, kilosGratuits: e.target.value }))}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" className="w-full h-11" disabled={pending}>
                    Enregistrer le trajet
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {trajets.length === 0 ? (
          <EmptyState
            title="Aucun trajet"
            description="Créez des lignes et des départs pour activer le guichet."
            action={
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button onClick={handleDemo} disabled={pending}>
                  Créer trajets de démo
                </Button>
                <Button variant="outline" onClick={() => setShowForm(true)}>
                  Nouveau trajet
                </Button>
              </div>
            }
          />
        ) : (
          <div className="space-y-4">
            {trajets.map((t) => (
              <Card key={t.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    {t.villeDepart} → {t.villeArrivee}
                  </CardTitle>
                  <CardDescription>
                    {formatMontantFc(t.prixBase)} · {t.kilosGratuits} kg gratuits ·{" "}
                    {formatMontantFc(t.prixParKilo)}/kg
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddDepart(t.id)}
                    >
                      + Départ (J+7)
                    </Button>
                  </div>
                  {t.departs.length > 0 ? (
                    <ListGroup title="Départs à venir">
                      {t.departs.map((d) => (
                        <ListItem
                          key={d.id}
                          title={formatDateFr(d.dateDepart)}
                          description={`${d.heureDepart} · ${d.statut}`}
                          showChevron={false}
                        />
                      ))}
                    </ListGroup>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucun départ à venir — ajoutez-en un pour le guichet.
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Button className="w-full" render={<Link href={guichetHref} />}>
          Aller au guichet
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
