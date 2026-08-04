"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Filter, Ticket } from "lucide-react";
import {
  SourceReservationBadge,
  StatutPaiementBadge,
  StatutReservationBadge,
} from "@/components/reservation/reservation-badges";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { gerantPath } from "@/lib/agence/routes";
import type { GerantReservationRow } from "@/lib/reports/list-gerant-reservations";
import {
  formatDateTimeFr,
  formatMontantFc,
  SOURCE_RESERVATION_LABELS,
  STATUT_PAIEMENT_LABELS,
  STATUT_RESERVATION_LABELS,
} from "@/lib/reservation/labels";

type GerantReservationsViewProps = {
  organizationId: string;
  reservations: GerantReservationRow[];
  filters: {
    statut?: string;
    source?: string;
    paiement?: string;
    from?: string;
    to?: string;
  };
  errorMessage?: string;
};

export function GerantReservationsView({
  organizationId,
  reservations,
  filters,
  errorMessage,
}: GerantReservationsViewProps) {
  const router = useRouter();
  const base = gerantPath(organizationId, "reservations");

  const [statut, setStatut] = React.useState(filters.statut ?? "");
  const [source, setSource] = React.useState(filters.source ?? "");
  const [paiement, setPaiement] = React.useState(filters.paiement ?? "");
  const [from, setFrom] = React.useState(filters.from ?? "");
  const [to, setTo] = React.useState(filters.to ?? "");

  function applyFilters(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (statut) params.set("statut", statut);
    if (source) params.set("source", source);
    if (paiement) params.set("paiement", paiement);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.push(qs ? `${base}?${qs}` : base);
  }

  function resetFilters() {
    setStatut("");
    setSource("");
    setPaiement("");
    setFrom("");
    setTo("");
    router.push(base);
  }

  const exportHref = React.useMemo(() => {
    const params = new URLSearchParams();
    if (filters.statut) params.set("statut", filters.statut);
    if (filters.source) params.set("source", filters.source);
    if (filters.paiement) params.set("paiement", filters.paiement);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    const qs = params.toString();
    return qs ? `${base}/export?${qs}` : `${base}/export`;
  }, [base, filters]);

  const hasActiveFilters = !!(
    filters.statut ||
    filters.source ||
    filters.paiement ||
    filters.from ||
    filters.to
  );

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Réservations"
        subtitle={
          errorMessage
            ? errorMessage
            : `${reservations.length} réservation${reservations.length !== 1 ? "s" : ""}`
        }
        actions={[
          {
            label: "Export CSV",
            onClick: () => {
              window.location.href = exportHref;
            },
            icon: <Download data-icon="inline-start" />,
          },
        ]}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
        <form
          onSubmit={applyFilters}
          className="rounded-xl border bg-card p-4"
        >
          <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Field>
              <FieldLabel htmlFor="filtre-statut">Statut</FieldLabel>
              <Select
                id="filtre-statut"
                value={statut}
                onChange={(e) => setStatut(e.target.value)}
              >
                <option value="">Tous</option>
                {Object.entries(STATUT_RESERVATION_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="filtre-source">Source</FieldLabel>
              <Select
                id="filtre-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="">Toutes</option>
                {Object.entries(SOURCE_RESERVATION_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="filtre-paiement">Paiement</FieldLabel>
              <Select
                id="filtre-paiement"
                value={paiement}
                onChange={(e) => setPaiement(e.target.value)}
              >
                <option value="">Tous</option>
                {Object.entries(STATUT_PAIEMENT_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="filtre-from">Du</FieldLabel>
              <Input
                id="filtre-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="filtre-to">Au</FieldLabel>
              <Input
                id="filtre-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </FieldGroup>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button type="submit">
              <Filter data-icon="inline-start" />
              Filtrer
            </Button>
            {hasActiveFilters ? (
              <Button type="button" variant="outline" onClick={resetFilters}>
                Réinitialiser
              </Button>
            ) : null}
          </div>
        </form>

        {reservations.length === 0 ? (
          <EmptyState
            icon={hasActiveFilters ? Filter : Ticket}
            title="Aucune réservation"
            description={
              hasActiveFilters
                ? "Modifiez les filtres (ex. source GUICHET vs EN_LIGNE)."
                : "Aucune réservation pour cette agence."
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead>Code</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Trajet</TableHead>
                  <TableHead>Départ</TableHead>
                  <TableHead>Montant</TableHead>
                  <TableHead>Statuts</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`${base}/${r.id}`)}
                  >
                    <TableCell className="font-mono text-xs">
                      <Link
                        href={`${base}/${r.id}`}
                        className="underline-offset-2 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.codeUnique}
                      </Link>
                    </TableCell>
                    <TableCell>{r.clientLabel}</TableCell>
                    <TableCell>
                      {r.villeDepart} → {r.villeArrivee}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDateTimeFr(r.dateDepart, r.heureDepart)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatMontantFc(r.prixTotal)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <StatutReservationBadge statut={r.statut} />
                        <StatutPaiementBadge statut={r.paiementStatut} />
                        <SourceReservationBadge source={r.source} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
