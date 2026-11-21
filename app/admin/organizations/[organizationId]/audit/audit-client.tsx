"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  exportOrgReportExcel,
  exportOrgReportPdf,
} from "@/lib/org/report-exports";
import {
  PilotageFrame,
  PilotageKpis,
  PilotageTable,
} from "@/components/org/pilotage-frame";

type Event = {
  id: string;
  createdAt: string;
  entityType: string;
  action: string;
  actorName: string;
  reason: string | null;
  branchName: string;
};

export function AuditClient({
  organizationId,
  orgName,
  events,
}: {
  organizationId: string;
  orgName: string;
  events: Event[];
}) {
  const [query, setQuery] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return events;
    return events.filter((event) =>
      [event.branchName, event.entityType, event.action, event.actorName, event.reason ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [events, query]);

  const actors = new Set(events.map((event) => event.actorName)).size;
  const departments = new Set(events.map((event) => event.branchName)).size;

  function handleExport(kind: "pdf" | "excel") {
    const meta = {
      orgName,
      reportTitle: "Audit interne",
      from: events.at(-1)?.createdAt.slice(0, 10) ?? today,
      to: events[0]?.createdAt.slice(0, 10) ?? today,
      branchNames: [...new Set(events.map((event) => event.branchName))],
      kpis: [
        { label: "Traces", value: String(events.length) },
        { label: "Départements", value: String(departments) },
        { label: "Auteurs", value: String(actors) },
      ],
    };
    const table = {
      title: "Journal d’audit",
      headers: ["Date", "Département", "Type", "Action", "Auteur", "Motif"],
      rows: rows.map((event) => [
        new Date(event.createdAt).toLocaleString("fr-FR"),
        event.branchName,
        event.entityType,
        event.action,
        event.actorName,
        event.reason ?? "—",
      ]),
    };
    const ok =
      kind === "pdf"
        ? exportOrgReportPdf(meta, table)
        : exportOrgReportExcel(meta, table);
    if (!ok && kind === "pdf") {
      toast.error("Autorisez les fenêtres popup pour l’export PDF.");
      return;
    }
    toast.success(kind === "pdf" ? "PDF prêt à imprimer" : "Fichier Excel téléchargé");
  }

  return (
    <PilotageFrame
      backHref={`/admin/organizations/${organizationId}`}
      kicker="Audit interne · lecture seule"
      title={orgName}
      subtitle="Créations, corrections et motifs. Le PDF et l’Excel exportent le tableau filtré, pas seulement un graphique."
      onPdf={() => handleExport("pdf")}
      onExcel={() => handleExport("excel")}
    >
      <PilotageKpis
        items={[
          { label: "Traces", value: String(events.length) },
          { label: "Affichées", value: String(rows.length), hint: "Après filtre" },
          { label: "Départements", value: String(departments) },
          { label: "Auteurs", value: String(actors) },
        ]}
      />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Filtrer département, action, auteur, motif…"
        className="h-9 shrink-0 rounded-full border border-border bg-card px-3 text-sm outline-none focus:border-[#1b9a4b]"
      />
      <PilotageTable
        title="Journal d’audit"
        headers={["Date", "Département", "Type", "Action", "Auteur", "Motif"]}
      >
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="text-muted-foreground">
              Aucune trace pour le moment.
            </td>
          </tr>
        ) : (
          rows.map((event) => (
            <tr key={event.id}>
              <td className="whitespace-nowrap text-muted-foreground">
                {new Date(event.createdAt).toLocaleString("fr-FR")}
              </td>
              <td className="font-medium">{event.branchName}</td>
              <td>{event.entityType}</td>
              <td>{event.action}</td>
              <td>{event.actorName}</td>
              <td className="max-w-[280px] truncate">{event.reason ?? "—"}</td>
            </tr>
          ))
        )}
      </PilotageTable>
    </PilotageFrame>
  );
}
