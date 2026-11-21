"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMoney, shortDay } from "@/components/reports/report-shell";
import {
  exportOrgReportExcel,
  exportOrgReportPdf,
} from "@/lib/org/report-exports";
import {
  PilotageFrame,
  PilotageTable,
} from "@/components/org/pilotage-frame";
import { PcaPeriodPicker } from "../pca/pca-period-picker";
import { cn } from "@/lib/utils";
import {
  postCentralCashAction,
  receiveRemittanceAction,
} from "@/lib/central-cash/actions";

type Remittance = {
  id: string;
  number: string;
  status: string;
  expectedUsd: number;
  declaredUsd: number;
  receivedUsd: number | null;
  varianceDeclaredUsd: number;
  varianceReceivedUsd: number | null;
  createdAt: string;
  branchName: string;
  branchCode: string;
  note: string | null;
};

type Journal = {
  id: string;
  number: string;
  kind: string;
  amountUsd: number;
  justification: string;
  createdAt: string;
  branchName: string | null;
};

type SeriesPoint = { day: string; entrees: number; sorties: number };

type Props = {
  organizationId: string;
  orgName: string;
  data: {
    view: "jour" | "jours" | "mois" | "annee";
    year: number;
    month: number;
    day: number;
    span: number;
    reportKind: string;
    from: string;
    to: string;
    periodLabel: string;
    rangeLabel: string;
    seriesGrain: "jour" | "mois";
    todayYear: number;
    todayMonth: number;
    todayDay: number;
    balanceUsd: number;
    inflowsUsd: number;
    outflowsUsd: number;
    netUsd: number;
    netDeltaPct: number | null;
    pendingCount: number;
    pendingUsd: number;
    disputedCount: number;
    series: SeriesPoint[];
    departments: { name: string; code: string; amountUsd: number }[];
    top: Journal[];
    alerts: { kind: string; label: string }[];
    remittances: Remittance[];
    journal: Journal[];
    branches: { id: string; name: string; code: string }[];
  };
};

type Flow = "flux" | "entrees" | "sorties";
type Ledger = "journal" | "versements";

export function CaisseCentraleClient({ organizationId, orgName, data }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [received, setReceived] = useState<Record<string, string>>({});
  const [kind, setKind] = useState<"ENTRY" | "EXIT">("ENTRY");
  const [amount, setAmount] = useState("");
  const [justification, setJustification] = useState("");
  const [flow, setFlow] = useState<Flow>("flux");
  const [ledger, setLedger] = useState<Ledger>("journal");
  const [query, setQuery] = useState("");

  function receive(id: string) {
    const n = Number(received[id]);
    if (!Number.isFinite(n)) {
      toast.error("Indiquez le montant reçu.");
      return;
    }
    start(async () => {
      try {
        await receiveRemittanceAction({
          organizationId,
          remittanceId: id,
          receivedUsd: n,
        });
        toast.success("Accusé de réception enregistré");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur");
      }
    });
  }

  function postMove() {
    start(async () => {
      try {
        await postCentralCashAction({
          organizationId,
          kind,
          amountUsd: Number(amount),
          justification,
        });
        setAmount("");
        setJustification("");
        toast.success(kind === "ENTRY" ? "Entrée enregistrée" : "Sortie enregistrée");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur");
      }
    });
  }

  const needle = query.trim().toLowerCase();
  const journalRows = useMemo(
    () =>
      data.journal.filter((row) =>
        !needle
          ? true
          : [row.number, row.justification, row.branchName, KIND[row.kind]]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(needle),
      ),
    [data.journal, needle],
  );
  const remittanceRows = useMemo(
    () =>
      data.remittances.filter((row) =>
        !needle
          ? true
          : [row.number, row.branchName, STATUS[row.status], row.note]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(needle),
      ),
    [data.remittances, needle],
  );

  function handleExport(exportKind: "pdf" | "excel") {
    const meta = {
      orgName,
      reportTitle: `Caisse centrale — ${data.periodLabel}`,
      from: data.from,
      to: data.to,
      branchNames: data.branches.map((branch) => branch.name),
      kpis: [
        { label: "Solde coffre", value: formatMoney(data.balanceUsd) },
        { label: "Entrées", value: formatMoney(data.inflowsUsd) },
        { label: "Sorties", value: formatMoney(data.outflowsUsd) },
        { label: "Flux net", value: formatMoney(data.netUsd) },
        { label: "En attente", value: formatMoney(data.pendingUsd) },
        { label: "Écarts", value: String(data.disputedCount) },
      ],
    };
    const journalTable = {
      title: "Journal du coffre",
      headers: ["Référence", "Type", "Département", "Montant", "Justificatif", "Date"],
      rows: data.journal.map((row) => [
        row.number,
        KIND[row.kind] ?? row.kind,
        row.branchName ?? "—",
        row.amountUsd,
        row.justification,
        new Date(row.createdAt).toLocaleString("fr-FR"),
      ]),
    };
    const remittanceTable = {
      title: "Versements",
      headers: ["Référence", "Département", "Statut", "Théorique", "Déclaré", "Reçu", "Écart"],
      rows: data.remittances.map((row) => [
        row.number,
        row.branchName,
        STATUS[row.status] ?? row.status,
        row.expectedUsd,
        row.declaredUsd,
        row.receivedUsd ?? "—",
        row.varianceReceivedUsd ?? row.varianceDeclaredUsd,
      ]),
    };
    const departmentTable = {
      title: "Versements reçus par département",
      headers: ["Département", "Code", "Montant USD"],
      rows: data.departments.map((row) => [row.name, row.code, row.amountUsd]),
    };
    const ok =
      exportKind === "pdf"
        ? exportOrgReportPdf(meta, journalTable, [remittanceTable, departmentTable])
        : exportOrgReportExcel(meta, journalTable, [remittanceTable, departmentTable]);
    if (!ok && exportKind === "pdf") {
      toast.error("Autorisez les fenêtres popup pour l’export PDF.");
      return;
    }
    toast.success(exportKind === "pdf" ? "PDF prêt à imprimer" : "Fichier Excel téléchargé");
  }

  const ledgerToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full bg-muted p-0.5 text-[11px]">
        <button
          type="button"
          className={cn(
            "rounded-full px-2.5 py-1 font-medium",
            ledger === "journal" ? "bg-[#1b9a4b] text-white" : "text-muted-foreground",
          )}
          onClick={() => setLedger("journal")}
        >
          Journal
        </button>
        <button
          type="button"
          className={cn(
            "rounded-full px-2.5 py-1 font-medium",
            ledger === "versements" ? "bg-[#1b9a4b] text-white" : "text-muted-foreground",
          )}
          onClick={() => setLedger("versements")}
        >
          Versements
        </button>
      </div>
      <label className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher"
          className="h-7 w-40 pl-7 text-xs"
        />
      </label>
    </div>
  );

  const periodText =
    data.periodLabel === data.rangeLabel
      ? `${data.reportKind} · ${data.periodLabel}`
      : `${data.periodLabel} · ${data.rangeLabel}`;

  return (
    <PilotageFrame
      backHref={`/admin/organizations/${organizationId}`}
      kicker="Caisse centrale"
      title={orgName}
      subtitle={`${periodText}. Le PDF et l’Excel reprennent cette période.`}
      onPdf={() => handleExport("pdf")}
      onExcel={() => handleExport("excel")}
    >
      <PcaPeriodPicker
        view={data.view}
        year={data.year}
        month={data.month}
        day={data.day}
        span={data.span}
        periodLabel={data.periodLabel}
        rangeLabel={data.rangeLabel}
        reportKind={data.reportKind}
        todayYear={data.todayYear}
        todayMonth={data.todayMonth}
        todayDay={data.todayDay}
      />

      <section className="grid shrink-0 items-start gap-3 lg:grid-cols-3">
        <div className="grid gap-3 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2">
            <article className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-xs text-muted-foreground">Solde du coffre</p>
                <p className="text-[11px] text-muted-foreground">
                  {signedMoney(data.netUsd)}
                </p>
              </div>
              <p className="text-xl font-semibold tracking-tight tabular-nums">
                {formatMoney(data.balanceUsd)}
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Flux net</p>
                <Delta pct={data.netDeltaPct} />
              </div>
              <p
                className={cn(
                  "text-xl font-semibold tracking-tight tabular-nums",
                  data.netUsd < 0 ? "text-[#dc4545]" : "text-[#157a3c]",
                )}
              >
                {signedMoney(data.netUsd)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Entrées {formatMoney(data.inflowsUsd)} · Sorties {formatMoney(data.outflowsUsd)}
              </p>
            </article>
          </div>

          <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Flux de trésorerie</h2>
                <p className="text-xs text-muted-foreground">{data.rangeLabel}</p>
              </div>
              <div className="flex rounded-full bg-muted p-0.5 text-[11px]">
                {(
                  [
                    ["flux", "Flux"],
                    ["entrees", "Entrées"],
                    ["sorties", "Sorties"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "rounded-full px-2.5 py-1 font-medium",
                      flow === id ? "bg-[#1b9a4b] text-white" : "text-muted-foreground",
                    )}
                    onClick={() => setFlow(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-44 w-full">
              <CashFlowChart
                data={data.series}
                flow={flow}
                grain={data.seriesGrain}
              />
            </div>
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
              {data.departments.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Aucun versement reçu sur cette période.
                </p>
              ) : (
                data.departments.map((row) => (
                  <div
                    key={row.code}
                    className="min-w-[120px] rounded-lg border border-border px-2.5 py-1.5"
                  >
                    <p className="truncate text-[11px] text-muted-foreground">{row.name}</p>
                    <p className="text-sm font-semibold tabular-nums">
                      {formatMoney(row.amountUsd)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </article>

          <div id="caisse-ledger">
            {ledger === "journal" ? (
              <PilotageTable
                title="Journal"
                className="h-72"
                toolbar={ledgerToolbar}
                headers={["Réf.", "Type", "Libellé", "Montant", "Date"]}
              >
                {journalRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-muted-foreground">
                      Aucun mouvement.
                    </td>
                  </tr>
                ) : (
                  journalRows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium">{row.number}</td>
                      <td>{KIND[row.kind] ?? row.kind}</td>
                      <td className="max-w-[220px] truncate">
                        {row.branchName ?? row.justification}
                      </td>
                      <td
                        className={
                          row.amountUsd < 0
                            ? "tabular-nums text-[#dc4545]"
                            : "tabular-nums text-[#157a3c]"
                        }
                      >
                        {signedMoney(row.amountUsd)}
                      </td>
                      <td className="whitespace-nowrap text-muted-foreground">
                        {new Date(row.createdAt).toLocaleString("fr-FR")}
                      </td>
                    </tr>
                  ))
                )}
              </PilotageTable>
            ) : (
              <PilotageTable
                title="Versements"
                className="h-72"
                toolbar={ledgerToolbar}
                headers={["Réf.", "Département", "Déclaré", "Reçu", "Statut"]}
              >
                {remittanceRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-muted-foreground">
                      Aucun versement.
                    </td>
                  </tr>
                ) : (
                  remittanceRows.map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium">{row.number}</td>
                      <td>{row.branchName}</td>
                      <td className="tabular-nums">{formatMoney(row.declaredUsd)}</td>
                      <td>
                        {row.status === "RECEIVED" ? (
                          <span className="tabular-nums">
                            {formatMoney(row.receivedUsd ?? 0)}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Input
                              className="h-7 w-24"
                              type="number"
                              min={0}
                              step="0.01"
                              value={received[row.id] ?? String(row.declaredUsd)}
                              onChange={(event) =>
                                setReceived((map) => ({ ...map, [row.id]: event.target.value }))
                              }
                            />
                            <Button
                              size="sm"
                              className="h-7"
                              disabled={pending}
                              onClick={() => receive(row.id)}
                            >
                              Recevoir
                            </Button>
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[11px] font-medium",
                            row.status === "DISPUTED"
                              ? "bg-[#fff4e5] text-[#c2410c]"
                              : "bg-[#e9f7ef] text-[#157a3c]",
                          )}
                        >
                          {STATUS[row.status] ?? row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </PilotageTable>
            )}
          </div>
        </div>

        <div className="grid gap-3">
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium">Accès rapide</p>
          <div className="mt-3 grid gap-2">
            <button
              type="button"
              onClick={() => setKind("ENTRY")}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm",
                kind === "ENTRY"
                  ? "border-[#b7e4c7] bg-[#f3fbf6] text-[#157a3c]"
                  : "border-border hover:bg-muted",
              )}
            >
              <ArrowDownLeft className="size-4" />
              Entrée de fonds
            </button>
            <button
              type="button"
              onClick={() => setKind("EXIT")}
              className={cn(
                "flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm",
                kind === "EXIT"
                  ? "border-[#fecaca] bg-[#fff5f5] text-[#dc4545]"
                  : "border-border hover:bg-muted",
              )}
            >
              <ArrowUpRight className="size-4" />
              Sortie de fonds
            </button>
            <button
              type="button"
              onClick={() => {
                setLedger("versements");
                document.getElementById("caisse-ledger")?.scrollIntoView({ block: "nearest" });
              }}
              className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span>Versements en attente</span>
              <span className="rounded-full bg-[#fff4e5] px-2 py-0.5 text-[11px] font-medium text-[#c2410c]">
                {data.pendingCount}
              </span>
            </button>
          </div>
          <div className="mt-3 grid gap-2">
            <div className="grid gap-1">
              <Label className="text-[11px]">Montant USD</Label>
              <Input
                className="h-8"
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </div>
            <div className="grid gap-1">
              <Label className="text-[11px]">Justificatif</Label>
              <Input
                className="h-8"
                value={justification}
                onChange={(event) => setJustification(event.target.value)}
                placeholder="Pièce, motif"
              />
            </div>
            <Button size="sm" className="h-8" disabled={pending} onClick={postMove}>
              {kind === "ENTRY" ? "Enregistrer l’entrée" : "Enregistrer la sortie"}
            </Button>
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h2 className="text-sm font-semibold">Plus gros mouvements</h2>
          <ul className="mt-3 space-y-3">
            {data.top.length === 0 ? (
              <li className="text-sm text-muted-foreground">Aucun mouvement sur la période.</li>
            ) : (
              data.top.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {row.branchName ?? row.justification}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {KIND[row.kind] ?? row.kind} · {row.number}
                    </p>
                  </div>
                  <p
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      row.amountUsd < 0 ? "text-[#dc4545]" : "text-[#157a3c]",
                    )}
                  >
                    {signedMoney(row.amountUsd)}
                  </p>
                </li>
              ))
            )}
          </ul>
        </article>
        <article className="rounded-2xl border border-[#d7f0e1] bg-[#f3fbf6] p-4 shadow-sm">
          <h2 className="text-sm font-semibold">À traiter</h2>
          <ul className="mt-3 space-y-3">
            {data.alerts.length === 0 ? (
              <li className="text-sm text-muted-foreground">
                Aucun versement en attente ni écart sur cette vue.
              </li>
            ) : (
              data.alerts.slice(0, 5).map((alert) => (
                <li key={alert.label} className="flex gap-2 text-sm">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[#c2410c]" />
                  <span>{alert.label}</span>
                </li>
              ))
            )}
          </ul>
          {data.alerts.length > 5 ? (
            <p className="mt-3 text-xs text-muted-foreground">
              {data.alerts.length - 5} autre{data.alerts.length - 5 > 1 ? "s" : ""} alerte
              {data.alerts.length - 5 > 1 ? "s" : ""}.
            </p>
          ) : null}
        </article>
        </div>
      </section>

    </PilotageFrame>
  );
}

function CashFlowChart(props: {
  data: SeriesPoint[];
  flow: Flow;
  grain: "jour" | "mois";
}) {
  const tick = (iso: string) =>
    props.grain === "mois"
      ? new Date(iso).toLocaleDateString("fr-FR", { month: "short" })
      : shortDay(iso);
  const showIn = props.flow !== "sorties";
  const showOut = props.flow !== "entrees";
  const axis = (
    <>
      <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
      <XAxis dataKey="day" tickFormatter={tick} tick={{ fontSize: 11 }} minTickGap={24} />
      <YAxis tick={{ fontSize: 11 }} width={40} />
      <Tooltip
        labelFormatter={(label) => tick(String(label))}
        formatter={(value, name) => [
          typeof value === "number" ? formatMoney(value) : String(value ?? ""),
          name === "entrees" ? "Entrées" : "Sorties",
        ]}
      />
    </>
  );
  if (props.data.length <= 2) {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={props.data} barCategoryGap="30%">
          {axis}
          {showIn ? <Bar dataKey="entrees" fill="#1b9a4b" radius={6} maxBarSize={28} /> : null}
          {showOut ? <Bar dataKey="sorties" fill="#dc4545" radius={6} maxBarSize={28} /> : null}
        </BarChart>
      </ResponsiveContainer>
    );
  }
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={props.data}>
        {axis}
        {showIn ? (
          <Area type="monotone" dataKey="entrees" stroke="#1b9a4b" fill="#1b9a4b" fillOpacity={0.12} strokeWidth={2} />
        ) : null}
        {showOut ? (
          <Area type="monotone" dataKey="sorties" stroke="#dc4545" fill="#dc4545" fillOpacity={0.08} strokeWidth={2} />
        ) : null}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Delta({ pct }: { pct: number | null }) {
  if (pct == null) {
    return <span className="text-[11px] text-muted-foreground">Pas de base précédente</span>;
  }
  const up = pct >= 0;
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        up ? "bg-[#e9f7ef] text-[#157a3c]" : "bg-[#fff5f5] text-[#dc4545]",
      )}
    >
      {up ? "+" : ""}
      {pct.toLocaleString("fr-FR")} %
    </span>
  );
}

function signedMoney(amount: number) {
  const prefix = amount > 0 ? "+" : "";
  return `${prefix}${formatMoney(amount)}`;
}

const STATUS: Record<string, string> = {
  PREPARED: "En attente",
  RECEIVED: "Reçu",
  DISPUTED: "En écart",
};

const KIND: Record<string, string> = {
  ENTRY: "Entrée",
  EXIT: "Sortie",
  REMITTANCE_IN: "Versement reçu",
};
