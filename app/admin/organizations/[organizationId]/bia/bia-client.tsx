"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PilotageFrame, PilotageTable } from "@/components/org/pilotage-frame";
import { TrendAreaChart } from "@/components/reports/report-charts";
import {
  exportOrgReportExcel,
  exportOrgReportPdf,
} from "@/lib/org/report-exports";
import { ControlBoardsView } from "@/components/org/control-boards";
import type { ControlBoards } from "@/lib/bia/boards";
import {
  advanceBiaIncidentAction,
  openBiaIncidentAction,
  runIntegrityChecksAction,
} from "@/lib/bia/actions";
import { cn } from "@/lib/utils";

type Finding = {
  id: string;
  ruleCode: string;
  severity: string;
  status: string;
  title: string;
  detail: string;
  branchName: string;
  detectedAt: string;
  incidentId: string | null;
};

type Incident = {
  id: string;
  title: string;
  severity: string;
  status: string;
  assigneeName: string | null;
  openedByName: string;
  createdAt: string;
  lastNote: string | null;
};

export function BiaClient(props: {
  organizationId: string;
  orgName: string;
  health: { ok: boolean; connections: number | null };
  overview: { findings: Finding[]; incidents: Incident[]; auditCount: number };
  boards: ControlBoards;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, setView] = useState<"supervision" | "caisse" | "stocks" | "acces">("supervision");
  const [ledger, setLedger] = useState<"constats" | "incidents">("constats");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const findings = props.overview.findings;
  const openRows = findings.filter(
    (row) => row.status === "OUVERT" || row.status === "QUALIFIE",
  );
  const openFindings = openRows.length;
  const followed = findings.filter((row) => row.incidentId).length;
  const followPct = findings.length === 0 ? 0 : Math.round((followed / findings.length) * 100);
  const byBranch = countBy(findings, (row) => row.branchName);
  const bySeverity = SEVERITY_ORDER.map((code) => ({
    code,
    count: findings.filter((row) => row.severity === code).length,
  })).filter((row) => row.count > 0);
  const maxSeverity = Math.max(1, ...bySeverity.map((row) => row.count));
  const spotlight = (openRows.length > 0 ? openRows : findings).slice(0, 4);
  const series = buildSeries(findings);
  const seriesTotal = series.reduce((sum, point) => sum + point.value, 0);

  function runChecks() {
    start(async () => {
      try {
        const result = await runIntegrityChecksAction(props.organizationId);
        toast.success(`${result.detected} constat(s). Aucune donnée métier modifiée.`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur");
      }
    });
  }

  function openIncident(findingId: string) {
    start(async () => {
      try {
        await openBiaIncidentAction({
          organizationId: props.organizationId,
          findingId,
        });
        toast.success("Incident ouvert");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur");
      }
    });
  }

  function advance(incidentId: string, status: "EN_COURS" | "RESOLU" | "CLOS") {
    start(async () => {
      try {
        await advanceBiaIncidentAction({
          organizationId: props.organizationId,
          incidentId,
          status,
          note: notes[incidentId] ?? "",
        });
        toast.success("Incident mis à jour");
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Erreur");
      }
    });
  }

  function handleExport(kind: "pdf" | "excel") {
    const today = new Date().toISOString().slice(0, 10);
    const meta = {
      orgName: props.orgName,
      reportTitle: "BIA Enterprise",
      from: today,
      to: today,
      branchNames: [...new Set(props.overview.findings.map((row) => row.branchName))],
      kpis: [
        { label: "PostgreSQL", value: props.health.ok ? "Disponible" : "Indisponible" },
        { label: "Connexions", value: String(props.health.connections ?? "—") },
        { label: "Constats ouverts", value: String(openFindings) },
        { label: "Traces d'audit 7 j", value: String(props.overview.auditCount) },
      ],
    };
    const findings = {
      title: "Constats d'intégrité",
      headers: ["Règle", "Gravité", "Statut", "Département", "Titre", "Détail"],
      rows: props.overview.findings.map((row) => [
        row.ruleCode,
        row.severity,
        row.status,
        row.branchName,
        row.title,
        row.detail,
      ]),
    };
    const incidents = {
      title: "Incidents",
      headers: ["Titre", "Gravité", "Statut", "Ouvert par", "Note"],
      rows: props.overview.incidents.map((row) => [
        row.title,
        row.severity,
        row.status,
        row.openedByName,
        row.lastNote ?? "—",
      ]),
    };
    const ok =
      kind === "pdf"
        ? exportOrgReportPdf(meta, findings, [incidents])
        : exportOrgReportExcel(meta, findings, [incidents]);
    if (!ok && kind === "pdf") {
      toast.error("Autorisez les fenêtres popup pour l’export PDF.");
      return;
    }
    toast.success(kind === "pdf" ? "PDF prêt à imprimer" : "Fichier Excel téléchargé");
  }

  return (
    <PilotageFrame
      backHref={`/admin/organizations/${props.organizationId}`}
      kicker="BIA Enterprise"
      title={props.orgName}
      subtitle="Santé de la base, constats d'intégrité et incidents. Les contrôles ne corrigent aucune vente, aucun stock et aucun versement."
      onPdf={() => handleExport("pdf")}
      onExcel={() => handleExport("excel")}
    >
      <div className="flex shrink-0 flex-wrap gap-1 rounded-full bg-muted p-0.5 text-xs">
        {(
          [
            ["supervision", "Supervision"],
            ["caisse", "Caisse"],
            ["stocks", "Stocks"],
            ["acces", "Accès"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              view === id
                ? "rounded-full bg-[#1b9a4b] px-3 py-1 font-medium text-white"
                : "rounded-full px-3 py-1 font-medium text-muted-foreground"
            }
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {view !== "supervision" ? (
        <ControlBoardsView board={view} data={props.boards} />
      ) : (
      <>
      <section className="grid min-w-0 shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Constats suivis</p>
          <div className="mt-2 flex items-center gap-3">
            <Ring percent={followPct} />
            <div>
              <p className="text-sm font-semibold text-[#0e6b3c]">
                {findings.length === 0 ? "Aucun" : `${followPct} %`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {followed} sur {findings.length} ont un incident
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Départements</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#0e6b3c]">{byBranch.length}</p>
          <ul className="mt-2 space-y-1">
            {byBranch.slice(0, 4).map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="size-1.5 shrink-0 rounded-full bg-[#1b9a4b]" />
                  <span className="truncate">{row.label}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">{row.count}</span>
              </li>
            ))}
            {byBranch.length === 0 ? (
              <li className="text-xs text-muted-foreground">Aucun constat pour l’instant.</li>
            ) : null}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">À traiter</p>
            <span className="text-[11px] text-muted-foreground">{openFindings}</span>
          </div>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {spotlight.length === 0 ? (
              <li className="text-xs text-muted-foreground">Rien à signaler.</li>
            ) : (
              spotlight.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{row.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {row.branchName} · {clock(row.detectedAt)}
                    </p>
                  </div>
                  <SeverityBadge severity={row.severity} />
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Santé</p>
          <p className={cn("mt-1 text-2xl font-semibold", props.health.ok ? "text-[#0e6b3c]" : "text-[#c2410c]")}>
            {props.health.ok ? "Disponible" : "Indisponible"}
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {props.health.connections == null
              ? "Connexions non lisibles"
              : `${props.health.connections} connexions PostgreSQL`}
          </p>
          <p className="mt-2 text-xs">
            Incidents{" "}
            <span className="font-semibold tabular-nums">{props.overview.incidents.length}</span>
            <span className="text-muted-foreground"> · audit 7 j </span>
            <span className="font-semibold tabular-nums">{props.overview.auditCount}</span>
          </p>
        </article>
      </section>

      <section className="grid min-w-0 shrink-0 gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <p className="text-sm font-semibold">Répartition</p>
          <ul className="mt-3 space-y-2">
            {bySeverity.length === 0 ? (
              <li className="text-xs text-muted-foreground">Aucun constat.</li>
            ) : (
              bySeverity.map((row) => (
                <li key={row.code}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{SEVERITY_LABEL[row.code]}</span>
                    <span className="tabular-nums text-muted-foreground">{row.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#e7f6ee]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round((row.count / maxSeverity) * 100)}%`,
                        background: SEVERITY_COLOR[row.code],
                      }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="min-w-0 rounded-2xl border border-border bg-card p-3 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Constats sur 7 jours</p>
              <p className="text-[11px] text-muted-foreground">
                {seriesTotal} détection{seriesTotal > 1 ? "s" : ""} · les contrôles ne modifient aucune donnée
              </p>
            </div>
            <Button size="sm" className="h-8" disabled={pending} onClick={runChecks}>
              Lancer les contrôles
            </Button>
          </div>
          <div className="mt-2 h-40 w-full min-w-0">
            <TrendAreaChart data={series} color="#1b9a4b" valueLabel="Constats" />
          </div>
        </article>
      </section>

      <PilotageTable
        title=""
        flow
        widths={
          ledger === "constats"
            ? ["26%", "16%", "12%", "12%", "24%", "10%"]
            : ["28%", "14%", "18%", "40%"]
        }
        headers={
          ledger === "constats"
            ? ["Règle", "Département", "Gravité", "Statut", "Détail", "Action"]
            : ["Titre", "Statut", "Ouvert par", "Suite"]
        }
        toolbar={
          <div className="flex rounded-full bg-muted p-0.5 text-[11px]">
            {(
              [
                ["constats", "Constats d'intégrité"],
                ["incidents", "Incidents"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "rounded-full px-2.5 py-1 font-medium",
                  ledger === id ? "bg-[#1b9a4b] text-white" : "text-muted-foreground",
                )}
                onClick={() => setLedger(id)}
              >
                {label}
              </button>
            ))}
          </div>
        }
      >
        {ledger === "constats" ? (
          findings.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-muted-foreground">
                Aucun constat. Lancez les contrôles.
              </td>
            </tr>
          ) : (
            findings.map((row) => (
              <tr key={row.id}>
                <td className="truncate font-medium" title={row.title}>
                  {row.title}
                </td>
                <td className="truncate" title={row.branchName}>
                  {row.branchName}
                </td>
                <td>
                  <SeverityBadge severity={row.severity} />
                </td>
                <td>
                  <StatusBadge status={row.status} />
                </td>
                <td className="truncate text-muted-foreground" title={row.detail}>
                  {row.detail}
                </td>
                <td>
                  {row.incidentId ? (
                    <span className="text-xs text-[#157a3c]">Suivi</span>
                  ) : (
                    <Button
                      size="sm"
                      className="h-7 px-2"
                      disabled={pending}
                      onClick={() => openIncident(row.id)}
                    >
                      Ouvrir
                    </Button>
                  )}
                </td>
              </tr>
            ))
          )
        ) : props.overview.incidents.length === 0 ? (
          <tr>
            <td colSpan={4} className="text-muted-foreground">
              Aucun incident.
            </td>
          </tr>
        ) : (
          props.overview.incidents.map((row) => (
            <tr key={row.id}>
              <td className="truncate font-medium" title={row.title}>
                {row.title}
              </td>
              <td>
                <StatusBadge status={row.status} />
              </td>
              <td className="truncate" title={row.openedByName}>
                {row.openedByName}
              </td>
              <td>
                {row.status === "CLOS" ? (
                  <span className="block truncate" title={row.lastNote ?? undefined}>
                    {row.lastNote ?? "—"}
                  </span>
                ) : (
                  <span className="flex min-w-0 items-center gap-1">
                    <input
                      value={notes[row.id] ?? ""}
                      onChange={(event) =>
                        setNotes((map) => ({ ...map, [row.id]: event.target.value }))
                      }
                      placeholder="Note"
                      className="h-7 min-w-0 flex-1 rounded border border-border px-2 text-xs"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 px-2"
                      disabled={pending}
                      onClick={() => advance(row.id, "EN_COURS")}
                    >
                      Traiter
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 shrink-0 px-2"
                      disabled={pending}
                      onClick={() => advance(row.id, "CLOS")}
                    >
                      Clôturer
                    </Button>
                  </span>
                )}
              </td>
            </tr>
          ))
        )}
      </PilotageTable>
      </>
      )}
    </PilotageFrame>
  );
}

const SEVERITY_ORDER = ["CRITIQUE", "ELEVEE", "MOYENNE", "INFO"] as const;

const SEVERITY_LABEL: Record<string, string> = {
  CRITIQUE: "Critique",
  ELEVEE: "Élevée",
  MOYENNE: "Moyenne",
  INFO: "Info",
};

const SEVERITY_COLOR: Record<string, string> = {
  CRITIQUE: "#9f1239",
  ELEVEE: "#c2410c",
  MOYENNE: "#d97706",
  INFO: "#1b9a4b",
};

const STATUS_LABEL: Record<string, string> = {
  OUVERT: "Ouvert",
  QUALIFIE: "Qualifié",
  EN_COURS: "En cours",
  RESOLU: "Résolu",
  CLOS: "Clos",
};

function SeverityBadge({ severity }: { severity: string }) {
  const tone =
    severity === "INFO"
      ? "bg-[#e9f7ef] text-[#157a3c]"
      : severity === "MOYENNE"
        ? "bg-[#fff7e6] text-[#b45309]"
        : "bg-[#fff1e8] text-[#c2410c]";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", tone)}>
      {SEVERITY_LABEL[severity] ?? severity}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "CLOS" || status === "RESOLU"
      ? "bg-[#e9f7ef] text-[#157a3c]"
      : status === "EN_COURS" || status === "QUALIFIE"
        ? "bg-[#fff7e6] text-[#b45309]"
        : "bg-[#fff1e8] text-[#c2410c]";
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", tone)}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

function Ring({ percent }: { percent: number }) {
  const radius = 28;
  const turn = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * turn;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
      <circle cx="36" cy="36" r={radius} fill="none" stroke="#e7f6ee" strokeWidth="7" />
      <circle
        cx="36"
        cy="36"
        r={radius}
        fill="none"
        stroke="#1b9a4b"
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${turn - filled}`}
        transform="rotate(-90 36 36)"
      />
      <text x="36" y="40" textAnchor="middle" fontSize="13" fontWeight="600" fill="#0e6b3c">
        {percent}%
      </text>
    </svg>
  );
}

function countBy<T>(rows: T[], pick: (row: T) => string) {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = pick(row);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function buildSeries(rows: { detectedAt: string }[]) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = dayKey(new Date(row.detectedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const day = dayKey(date);
    return { day, value: counts.get(day) ?? 0 };
  });
}

function dayKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function clock(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
