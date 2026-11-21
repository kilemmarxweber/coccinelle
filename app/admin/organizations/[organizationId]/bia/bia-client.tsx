"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  PilotageFrame,
  PilotageKpis,
  PilotageTable,
} from "@/components/org/pilotage-frame";
import {
  exportOrgReportExcel,
  exportOrgReportPdf,
} from "@/lib/org/report-exports";
import { ControlBoardsView } from "@/components/org/control-boards";
import type { ControlBoards } from "@/lib/bia/boards";

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
  const [notes, setNotes] = useState<Record<string, string>>({});
  const openFindings = props.overview.findings.filter(
    (row) => row.status === "OUVERT" || row.status === "QUALIFIE",
  ).length;

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
      <PilotageKpis
        items={[
          {
            label: "PostgreSQL",
            value: props.health.ok ? "Disponible" : "Indisponible",
            hint:
              props.health.connections == null
                ? "Connexions non lisibles"
                : `${props.health.connections} connexions`,
            tone: props.health.ok ? "green" : "alert",
          },
          { label: "Constats ouverts", value: String(openFindings) },
          { label: "Incidents", value: String(props.overview.incidents.length) },
          { label: "Audit 7 jours", value: String(props.overview.auditCount) },
        ]}
      />
      <div className="shrink-0">
        <Button size="sm" disabled={pending} onClick={runChecks}>
          Lancer les contrôles
        </Button>
      </div>
      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-2">
        <PilotageTable
          title="Constats d'intégrité"
          headers={["Règle", "Département", "Gravité", "Statut", "Détail", "Action"]}
        >
          {props.overview.findings.length === 0 ? (
            <tr>
              <td colSpan={6} className="text-muted-foreground">
                Aucun constat. Lancez les contrôles.
              </td>
            </tr>
          ) : (
            props.overview.findings.map((row) => (
              <tr key={row.id}>
                <td className="font-medium">{row.title}</td>
                <td>{row.branchName}</td>
                <td>{row.severity}</td>
                <td>{row.status}</td>
                <td className="max-w-[220px] truncate">{row.detail}</td>
                <td>
                  {row.incidentId ? (
                    "Suivi"
                  ) : (
                    <Button
                      size="sm"
                      className="h-7"
                      disabled={pending}
                      onClick={() => openIncident(row.id)}
                    >
                      Ouvrir
                    </Button>
                  )}
                </td>
              </tr>
            ))
          )}
        </PilotageTable>
        <PilotageTable
          title="Incidents"
          headers={["Titre", "Statut", "Ouvert par", "Suite"]}
        >
          {props.overview.incidents.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-muted-foreground">
                Aucun incident.
              </td>
            </tr>
          ) : (
            props.overview.incidents.map((row) => (
              <tr key={row.id}>
                <td className="font-medium">{row.title}</td>
                <td>{row.status}</td>
                <td>{row.openedByName}</td>
                <td>
                  {row.status === "CLOS" ? (
                    row.lastNote
                  ) : (
                    <span className="flex flex-wrap items-center gap-1">
                      <input
                        value={notes[row.id] ?? ""}
                        onChange={(event) =>
                          setNotes((map) => ({ ...map, [row.id]: event.target.value }))
                        }
                        placeholder="Note"
                        className="h-7 w-28 rounded border border-border px-2 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7"
                        disabled={pending}
                        onClick={() => advance(row.id, "EN_COURS")}
                      >
                        Traiter
                      </Button>
                      <Button
                        size="sm"
                        className="h-7"
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
      </div>
      </>
      )}
    </PilotageFrame>
  );
}
