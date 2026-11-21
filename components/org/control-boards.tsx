"use client";

import { formatMoney } from "@/components/reports/report-shell";
import { cn } from "@/lib/utils";
import type { ControlBoards } from "@/lib/bia/boards";

const KIND_LABEL: Record<string, string> = {
  ENTREE: "Entrée",
  SORTIE: "Sortie",
  AJUSTEMENT: "Ajustement",
  TRANSFERT: "Transfert",
  PERTE: "Perte",
  CONSO: "Conso",
  RETOUR: "Retour",
  INVENTAIRE: "Inventaire",
};

const ROLE_LABEL: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Admin",
  user: "Membre",
};

export function ControlBoardsView(props: {
  board: "caisse" | "stocks" | "acces";
  data: ControlBoards;
}) {
  if (props.board === "caisse") return <CashBoard data={props.data} />;
  if (props.board === "stocks") return <StockBoard data={props.data} />;
  return <AccessBoard data={props.data} />;
}

function CashBoard({ data }: { data: ControlBoards }) {
  const cash = data.cash;
  const pct = cash.closed === 0 ? 0 : Math.round((cash.clean / cash.closed) * 100);
  return (
    <div className="grid shrink-0 gap-3">
      <KpiRow
        items={[
          { label: "Sessions", value: String(cash.sessions) },
          { label: "Clôturées", value: String(cash.closed) },
          { label: "Ouvertes", value: String(cash.open) },
          { label: "Versements ouverts", value: String(cash.pendingRemittances) },
          {
            label: "Écart cumulé",
            value: formatMoney(cash.varianceUsd),
            tone: cash.varianceUsd === 0 ? "ok" : "alert",
          },
        ]}
      />
      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold">Clôtures sans écart</p>
          <div className="mt-3 flex items-center gap-4">
            <Ring percent={pct} />
            <div>
              <p className="text-sm font-medium text-[#0e6b3c]">
                {cash.clean} sur {cash.closed}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.windowDays} derniers jours, USD
              </p>
            </div>
          </div>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
          <p className="text-sm font-semibold">Sessions de caisse</p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-[11px] tracking-wide text-[#157a3c] uppercase">
              <tr>
                <th className="py-1 font-semibold">Département</th>
                <th className="py-1 font-semibold">Statut</th>
                <th className="py-1 font-semibold">Théorique</th>
                <th className="py-1 font-semibold">Déclaré</th>
                <th className="py-1 font-semibold">Écart</th>
              </tr>
            </thead>
            <tbody>
              {cash.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-muted-foreground">
                    Aucune session sur la période.
                  </td>
                </tr>
              ) : (
                cash.rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-2">{row.branch}</td>
                    <td className="py-2">{row.status === "OPEN" ? "Ouverte" : "Close"}</td>
                    <td className="py-2 tabular-nums">{moneyOrDash(row.expected)}</td>
                    <td className="py-2 tabular-nums">{moneyOrDash(row.declared)}</td>
                    <td
                      className={cn(
                        "py-2 tabular-nums",
                        (row.variance ?? 0) === 0 ? "text-[#157a3c]" : "text-[#c2410c]",
                      )}
                    >
                      {moneyOrDash(row.variance)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </article>
      </section>
    </div>
  );
}

function StockBoard({ data }: { data: ControlBoards }) {
  const stock = data.stock;
  const max = Math.max(1, ...stock.byKind.map((row) => row.count));
  return (
    <div className="grid shrink-0 gap-3">
      <KpiRow
        items={[
          { label: "Mouvements", value: String(stock.movements) },
          { label: "Entrées", value: String(stock.inQty) },
          { label: "Sorties", value: String(stock.outQty) },
          { label: "Ajustements", value: String(stock.adjustments) },
          { label: "Pertes / inventaires", value: String(stock.losses), tone: stock.losses > 0 ? "alert" : "ok" },
        ]}
      />
      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold">Types de mouvement</p>
          <ul className="mt-3 space-y-2">
            {stock.byKind.length === 0 ? (
              <li className="text-xs text-muted-foreground">Aucun mouvement.</li>
            ) : (
              stock.byKind.map((row) => (
                <li key={row.kind}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{KIND_LABEL[row.kind] ?? row.kind}</span>
                    <span className="tabular-nums text-muted-foreground">{row.count}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#e7f6ee]">
                    <div
                      className="h-full rounded-full bg-[#1b9a4b]"
                      style={{ width: `${Math.round((row.count / max) * 100)}%` }}
                    />
                  </div>
                </li>
              ))
            )}
          </ul>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
          <p className="text-sm font-semibold">Derniers mouvements</p>
          <p className="text-xs text-muted-foreground">{data.windowDays} derniers jours</p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-[11px] tracking-wide text-[#157a3c] uppercase">
              <tr>
                <th className="py-1 font-semibold">Date</th>
                <th className="py-1 font-semibold">Produit</th>
                <th className="py-1 font-semibold">Type</th>
                <th className="py-1 font-semibold">Qté</th>
                <th className="py-1 font-semibold">Avant → après</th>
              </tr>
            </thead>
            <tbody>
              {stock.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-3 text-muted-foreground">
                    Aucun mouvement de stock.
                  </td>
                </tr>
              ) : (
                stock.rows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="py-2 whitespace-nowrap text-muted-foreground">
                      {clock(row.at)}
                    </td>
                    <td className="py-2">
                      <p className="font-medium">{row.product}</p>
                      <p className="text-[11px] text-muted-foreground">{row.branch}</p>
                    </td>
                    <td className="py-2">{KIND_LABEL[row.kind] ?? row.kind}</td>
                    <td
                      className={cn(
                        "py-2 tabular-nums",
                        row.kind === "PERTE" || row.kind === "SORTIE"
                          ? "text-[#c2410c]"
                          : "text-[#157a3c]",
                      )}
                    >
                      {row.quantity}
                    </td>
                    <td className="py-2 tabular-nums">
                      {row.before} → {row.after}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </article>
      </section>
    </div>
  );
}

function AccessBoard({ data }: { data: ControlBoards }) {
  const access = data.access;
  return (
    <div className="grid shrink-0 gap-3">
      <KpiRow
        items={[
          { label: "Comptes", value: String(access.members) },
          { label: "Invitations", value: String(access.invitations) },
          { label: "Sessions actives", value: String(access.activeSessions) },
          { label: "Mot de passe à changer", value: String(access.mustChange), tone: access.mustChange > 0 ? "alert" : "ok" },
          { label: "Suspendus", value: String(access.suspended), tone: access.suspended > 0 ? "alert" : "ok" },
        ]}
      />
      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm lg:col-span-2">
          <p className="text-sm font-semibold">Comptes de l’organisation</p>
          <table className="mt-3 w-full text-left text-sm">
            <thead className="text-[11px] tracking-wide text-[#157a3c] uppercase">
              <tr>
                <th className="py-1 font-semibold">Nom</th>
                <th className="py-1 font-semibold">Rôle</th>
                <th className="py-1 font-semibold">Depuis</th>
                <th className="py-1 font-semibold">Statut</th>
              </tr>
            </thead>
            <tbody>
              {access.rows.map((row) => (
                <tr key={row.id} className="border-t border-border">
                  <td className="py-2 font-medium">{row.name}</td>
                  <td className="py-2">{ROLE_LABEL[row.role] ?? row.role}</td>
                  <td className="py-2 text-muted-foreground">
                    {new Date(row.since).toLocaleDateString("fr-FR")}
                  </td>
                  <td className="py-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        row.suspended
                          ? "bg-[#fff1e8] text-[#c2410c]"
                          : row.mustChange
                            ? "bg-[#fff7e6] text-[#b45309]"
                            : "bg-[#e9f7ef] text-[#157a3c]",
                      )}
                    >
                      {row.suspended ? "Suspendu" : row.mustChange ? "À renouveler" : "Actif"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
        <article className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold">Invitations en attente</p>
          <ul className="mt-3 space-y-2">
            {access.invites.length === 0 ? (
              <li className="text-xs text-muted-foreground">Aucune invitation ouverte.</li>
            ) : (
              access.invites.map((row) => (
                <li key={row.id} className="text-sm">
                  <p className="truncate font-medium">{row.email}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {ROLE_LABEL[row.role] ?? row.role} · en attente
                  </p>
                </li>
              ))
            )}
          </ul>
        </article>
      </section>
    </div>
  );
}

function KpiRow(props: {
  items: { label: string; value: string; tone?: "ok" | "alert" }[];
}) {
  return (
    <section className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
      {props.items.map((item) => (
        <article key={item.label} className="rounded-xl border border-[#d7f0e1] bg-[#f3fbf6] px-3 py-2.5">
          <p className="text-[11px] text-muted-foreground">{item.label}</p>
          <p
            className={cn(
              "mt-0.5 text-lg font-semibold tabular-nums",
              item.tone === "alert" && "text-[#c2410c]",
            )}
          >
            {item.value}
          </p>
        </article>
      ))}
    </section>
  );
}

function Ring({ percent }: { percent: number }) {
  const radius = 32;
  const turn = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, percent)) / 100) * turn;
  return (
    <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden>
      <circle cx="42" cy="42" r={radius} fill="none" stroke="#e7f6ee" strokeWidth="8" />
      <circle
        cx="42"
        cy="42"
        r={radius}
        fill="none"
        stroke="#1b9a4b"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${turn - filled}`}
        transform="rotate(-90 42 42)"
      />
      <text x="42" y="46" textAnchor="middle" fontSize="14" fontWeight="600" fill="#0e6b3c">
        {percent}%
      </text>
    </svg>
  );
}

function moneyOrDash(value: number | null) {
  if (value == null) return "—";
  return formatMoney(value);
}

function clock(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
