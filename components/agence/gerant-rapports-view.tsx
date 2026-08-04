"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Download, Smartphone, Wallet } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { gerantPath } from "@/lib/agence/routes";
import type { GerantCaRapport } from "@/lib/reports/gerant-ca";
import {
  formatMontantFc,
  METHODE_PAIEMENT_LABELS,
} from "@/lib/reservation/labels";

type GerantRapportsViewProps = {
  rapport: GerantCaRapport;
};

const METHODE_ICONS = {
  CASH: Wallet,
  MOBILE_MONEY: Smartphone,
  CARTE: CreditCard,
} as const;

export function GerantRapportsView({ rapport }: GerantRapportsViewProps) {
  const router = useRouter();
  const base = gerantPath(rapport.organizationId, "rapports");
  const [from, setFrom] = React.useState(rapport.period.from);
  const [to, setTo] = React.useState(rapport.period.to);

  function applyPeriod(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams({ from, to });
    router.push(`${base}?${params.toString()}`);
  }

  const exportHref = `${base}/export?from=${encodeURIComponent(rapport.period.from)}&to=${encodeURIComponent(rapport.period.to)}`;

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Rapports"
        subtitle={`CA du ${rapport.period.from} au ${rapport.period.to}`}
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

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-6 md:px-6">
        <form
          onSubmit={applyPeriod}
          className="rounded-xl border bg-card p-4"
        >
          <FieldGroup className="grid gap-4 sm:grid-cols-2 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <Field>
              <FieldLabel htmlFor="ca-from">Du</FieldLabel>
              <Input
                id="ca-from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="ca-to">Au</FieldLabel>
              <Input
                id="ca-to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" className="w-full md:w-auto">
              Actualiser
            </Button>
          </FieldGroup>
        </form>

        <StatGrid>
          <StatCard
            title="CA période"
            value={formatMontantFc(rapport.caTotal)}
            subtitle={`${rapport.paiementsCount} paiement${rapport.paiementsCount !== 1 ? "s" : ""} PAYÉ`}
            icon={Banknote}
            variant="success"
          />
          {rapport.parMethode.map((m) => {
            const Icon = METHODE_ICONS[m.methode];
            return (
              <StatCard
                key={m.methode}
                title={METHODE_PAIEMENT_LABELS[m.methode] ?? m.methode}
                value={formatMontantFc(m.montant)}
                subtitle={`${m.count} paiement${m.count !== 1 ? "s" : ""}`}
                icon={Icon}
              />
            );
          })}
        </StatGrid>

        <Card>
          <CardHeader>
            <CardTitle>Répartition par mode de paiement</CardTitle>
            <CardDescription>
              Somme des paiements statut PAYÉ sur la période (hors réservations
              annulées).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {rapport.parMethode.map((m) => {
                const pct =
                  rapport.caTotal > 0
                    ? Math.round((m.montant / rapport.caTotal) * 100)
                    : 0;
                return (
                  <li
                    key={m.methode}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span>
                      {METHODE_PAIEMENT_LABELS[m.methode] ?? m.methode}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatMontantFc(m.montant)} · {pct} %
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
