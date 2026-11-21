"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  PilotageFrame,
  PilotageTable,
} from "@/components/org/pilotage-frame";
import { PcaPeriodPicker } from "../pca/pca-period-picker";
import { ControlBoardsView } from "@/components/org/control-boards";
import type { ControlBoards } from "@/lib/bia/boards";
import {
  exportOrgReportExcel,
  exportOrgReportPdf,
} from "@/lib/org/report-exports";
import { cn } from "@/lib/utils";

type Event = {
  id: string;
  createdAt: string;
  entityType: string;
  action: string;
  actorName: string;
  reason: string | null;
  branchName: string;
};

type Period = {
  view: "jour" | "jours" | "mois" | "annee";
  year: number;
  month: number;
  day: number;
  span: number;
  reportKind: string;
  periodLabel: string;
  rangeLabel: string;
  from: string;
  to: string;
  todayYear: number;
  todayMonth: number;
  todayDay: number;
};

type Level = "élevé" | "moyen" | "info";
type Family = "tout" | "vente" | "caisse" | "stock" | "crédit" | "sensible";

const FAMILIES: { id: Family; label: string }[] = [
  { id: "tout", label: "Tout" },
  { id: "vente", label: "Ventes" },
  { id: "caisse", label: "Caisse" },
  { id: "stock", label: "Stock" },
  { id: "crédit", label: "Crédit" },
  { id: "sensible", label: "Sensibles" },
];

export function AuditClient({
  organizationId,
  orgName,
  events,
  boards,
  period,
}: {
  organizationId: string;
  orgName: string;
  events: Event[];
  boards: ControlBoards;
  period: Period;
}) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<Family>("tout");
  const [lens, setLens] = useState<"journal" | "caisse" | "stocks" | "acces">("journal");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return events.filter((event) => {
      if (family === "sensible" && levelOf(event) === "info") return false;
      if (family !== "tout" && family !== "sensible" && familyOf(event) !== family) return false;
      if (!needle) return true;
      return [event.branchName, event.entityType, event.action, event.actorName, event.reason ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [events, family, query]);

  const withReason = events.filter((event) => event.reason?.trim()).length;
  const reasonPct = events.length === 0 ? 0 : Math.round((withReason / events.length) * 100);
  const actors = new Set(events.map((event) => event.actorName));
  const byBranch = countBy(events, (event) => event.branchName);
  const byType = countBy(events, (event) => labelType(event.entityType));
  const levels = {
    élevé: events.filter((event) => levelOf(event) === "élevé").length,
    moyen: events.filter((event) => levelOf(event) === "moyen").length,
    info: events.filter((event) => levelOf(event) === "info").length,
  };
  const sensitive = events.filter((event) => levelOf(event) !== "info");
  const spotlight = sensitive.length > 0 ? sensitive : events.slice(0, 4);
  const timeline = [...events].slice(0, 6).reverse();
  const maxType = Math.max(1, ...byType.map((row) => row.count));

  function handleExport(kind: "pdf" | "excel") {
    const meta = {
      orgName,
      reportTitle: `Audit interne — ${period.periodLabel}`,
      from: period.from,
      to: period.to,
      branchNames: byBranch.map((row) => row.label),
      kpis: [
        { label: "Traces", value: String(events.length) },
        { label: "Avec motif", value: `${reasonPct} %` },
        { label: "Sensibles", value: String(levels.élevé + levels.moyen) },
        { label: "Auteurs", value: String(actors.size) },
      ],
    };
    const table = {
      title: "Journal d’audit",
      headers: ["Date", "Niveau", "Type", "Action", "Département", "Auteur", "Motif"],
      rows: rows.map((event) => [
        new Date(event.createdAt).toLocaleString("fr-FR"),
        levelOf(event),
        labelType(event.entityType),
        labelAction(event.action),
        event.branchName,
        event.actorName,
        event.reason ?? "—",
      ]),
    };
    const ok =
      kind === "pdf" ? exportOrgReportPdf(meta, table) : exportOrgReportExcel(meta, table);
    if (!ok && kind === "pdf") {
      toast.error("Autorisez les fenêtres popup pour l’export PDF.");
      return;
    }
    toast.success(kind === "pdf" ? "PDF prêt à imprimer" : "Fichier Excel téléchargé");
  }

  const periodText =
    period.periodLabel === period.rangeLabel
      ? `${period.reportKind} · ${period.periodLabel}`
      : `${period.periodLabel} · ${period.rangeLabel}`;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex rounded-full bg-muted p-0.5 text-[11px]">
        {FAMILIES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={cn(
              "rounded-full px-2.5 py-1 font-medium",
              family === item.id ? "bg-[#1b9a4b] text-white" : "text-muted-foreground",
            )}
            onClick={() => setFamily(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <label className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Rechercher"
          className="h-7 w-36 pl-7 text-xs"
        />
      </label>
    </div>
  );

  return (
    <PilotageFrame
      backHref={`/admin/organizations/${organizationId}`}
      kicker="Audit interne · lecture seule"
      title={orgName}
      subtitle={`${periodText}. Le PDF et l’Excel reprennent le journal filtré.`}
      onPdf={() => handleExport("pdf")}
      onExcel={() => handleExport("excel")}
    >
      <div className="flex shrink-0 flex-wrap gap-1 rounded-full bg-muted p-0.5 text-xs">
        {(
          [
            ["journal", "Journal"],
            ["caisse", "Caisse"],
            ["stocks", "Stocks"],
            ["acces", "Accès"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              lens === id
                ? "rounded-full bg-[#1b9a4b] px-3 py-1 font-medium text-white"
                : "rounded-full px-3 py-1 font-medium text-muted-foreground"
            }
            onClick={() => setLens(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {lens !== "journal" ? (
        <ControlBoardsView board={lens} data={boards} />
      ) : (
      <>
      <PcaPeriodPicker
        view={period.view}
        year={period.year}
        month={period.month}
        day={period.day}
        span={period.span}
        periodLabel={period.periodLabel}
        rangeLabel={period.rangeLabel}
        reportKind={period.reportKind}
        todayYear={period.todayYear}
        todayMonth={period.todayMonth}
        todayDay={period.todayDay}
      />

      <section className="grid shrink-0 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Traces motivées</p>
          <div className="mt-2 flex items-center gap-3">
            <Ring percent={reasonPct} />
            <div>
              <p className="text-sm font-semibold text-[#0e6b3c]">
                {reasonPct === 0 && events.length === 0 ? "Aucune" : `${reasonPct} %`}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {withReason} sur {events.length} avec un motif
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
              <li className="text-xs text-muted-foreground">Aucune trace sur la période.</li>
            ) : null}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">À regarder</p>
            <span className="text-[11px] text-muted-foreground">{spotlight.length}</span>
          </div>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
            {spotlight.length === 0 ? (
              <li className="text-xs text-muted-foreground">Rien à signaler.</li>
            ) : (
              spotlight.map((event) => (
                <li key={event.id} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium">{labelAction(event.action)}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {event.actorName} · {clock(event.createdAt)}
                    </p>
                  </div>
                  <LevelBadge level={levelOf(event)} />
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground">Auteurs</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[#0e6b3c]">{actors.size}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Lecture seule. Aucune trace n’est modifiable depuis cet écran.
          </p>
          <p className="mt-2 text-xs">
            Sensibles{" "}
            <span className="font-semibold tabular-nums">{levels.élevé + levels.moyen}</span>
          </p>
        </article>
      </section>

      <section className="grid shrink-0 gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-3 shadow-sm">
          <p className="text-sm font-semibold">Répartition</p>
          <ul className="mt-3 space-y-2">
            {byType.length === 0 ? (
              <li className="text-xs text-muted-foreground">Aucune trace.</li>
            ) : (
              byType.slice(0, 5).map((row) => (
                <li key={row.label}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{row.label}</span>
                    <span className="tabular-nums text-muted-foreground">{row.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#e7f6ee]">
                    <div
                      className="h-full rounded-full bg-[#1b9a4b]"
                      style={{ width: `${Math.round((row.count / maxType) * 100)}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </article>

        <article className="rounded-2xl border border-border bg-card p-3 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">Chronologie</p>
            <p className="text-[11px] text-muted-foreground">{period.rangeLabel}</p>
          </div>
          {timeline.length === 0 ? (
            <p className="mt-6 text-sm text-muted-foreground">Aucune trace sur cette période.</p>
          ) : (
            <ol className="mt-4 flex gap-3 overflow-x-auto pb-1">
              {timeline.map((event) => (
                <li key={event.id} className="min-w-[140px] flex-1">
                  <span
                    className={cn(
                      "mb-2 block size-2.5 rounded-full",
                      levelOf(event) === "élevé"
                        ? "bg-[#c2410c]"
                        : levelOf(event) === "moyen"
                          ? "bg-[#d97706]"
                          : "bg-[#1b9a4b]",
                    )}
                  />
                  <p className="text-[11px] text-muted-foreground">{clock(event.createdAt)}</p>
                  <p className="truncate text-xs font-medium">{labelAction(event.action)}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{event.branchName}</p>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-[#c2410c]" /> Élevé {levels.élevé}</span>
            <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-[#d97706]" /> Moyen {levels.moyen}</span>
            <span className="inline-flex items-center gap-1"><i className="size-2 rounded-full bg-[#1b9a4b]" /> Info {levels.info}</span>
          </p>
        </article>
      </section>

      <PilotageTable
        title="Journal"
        className="h-80 shrink-0"
        toolbar={toolbar}
        headers={["Heure", "Niveau", "Type", "Action", "Département", "Auteur"]}
      >
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="text-muted-foreground">
              Aucune trace pour ce filtre.
            </td>
          </tr>
        ) : (
          rows.map((event) => (
            <tr key={event.id}>
              <td className="whitespace-nowrap text-muted-foreground">{clock(event.createdAt)}</td>
              <td>
                <LevelBadge level={levelOf(event)} />
              </td>
              <td>{labelType(event.entityType)}</td>
              <td className="max-w-[240px]">
                <p className="truncate font-medium">{labelAction(event.action)}</p>
                {event.reason ? (
                  <p className="truncate text-[11px] text-muted-foreground">{event.reason}</p>
                ) : null}
              </td>
              <td>{event.branchName}</td>
              <td className="whitespace-nowrap">{event.actorName}</td>
            </tr>
          ))
        )}
      </PilotageTable>
      </>
      )}
    </PilotageFrame>
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
      <text
        x="36"
        y="40"
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        fill="#0e6b3c"
      >
        {percent}%
      </text>
    </svg>
  );
}

function LevelBadge({ level }: { level: Level }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
        level === "élevé" && "bg-[#fff1e8] text-[#c2410c]",
        level === "moyen" && "bg-[#fff7e6] text-[#b45309]",
        level === "info" && "bg-[#e9f7ef] text-[#157a3c]",
      )}
    >
      {level === "élevé" ? "Élevé" : level === "moyen" ? "Moyen" : "Info"}
    </span>
  );
}

function levelOf(event: Event): Level {
  const blob = `${event.action} ${event.entityType}`.toUpperCase();
  if (/CORRECT|EXIT|DELETE|ANNUL|DISPUTE|REJECT/.test(blob)) return "élevé";
  if (/REMIT|CASH|RECEIVE|ENTRY|CREDIT|STOCK/.test(blob)) return "moyen";
  return "info";
}

function familyOf(event: Event): Exclude<Family, "tout" | "sensible"> | "autre" {
  const type = event.entityType.toUpperCase();
  if (type.includes("SALE")) return "vente";
  if (type.includes("CASH") || type.includes("REMIT")) return "caisse";
  if (type.includes("STOCK")) return "stock";
  if (type.includes("CREDIT")) return "crédit";
  return "autre";
}

function labelType(entityType: string) {
  const type = entityType.toUpperCase();
  if (type.includes("SALE")) return "Vente";
  if (type.includes("REMIT")) return "Versement";
  if (type.includes("CASH")) return "Caisse";
  if (type.includes("STOCK")) return "Stock";
  if (type.includes("CREDIT")) return "Crédit";
  if (type.includes("BIA")) return "Contrôle BIA";
  return entityType;
}

function countBy(events: Event[], pick: (event: Event) => string) {
  const map = new Map<string, number>();
  for (const event of events) {
    const key = pick(event);
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function labelAction(action: string) {
  const known: Record<string, string> = {
    RECEIVE: "Réception",
    ENTRY: "Entrée",
    EXIT: "Sortie",
    RUN_CHECKS: "Contrôles",
  };
  return known[action] ?? action;
}

function clock(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
