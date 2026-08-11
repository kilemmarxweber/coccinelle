"use client";

import { FOLIO_SECTION_LABEL } from "@/lib/hotel/folio-note";
import {
  formatConfiguredRateLabel,
  formatPrimaryAmount,
  formatSecondaryAmount,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";
import { cn } from "@/lib/utils";

export type StayFolioStatementViewModel = {
  guestName: string;
  roomNumber: string;
  closed?: boolean;
  sections: {
    kind: string;
    label: string;
    total: number;
    lines: {
      id: string;
      description: string;
      quantity: number;
      amount: number;
    }[];
  }[];
  payments: {
    id: string;
    receiptNumber: string;
    method: string;
    amountUsd: number;
    paidAt: string | Date;
    note?: string | null;
  }[];
  charges: number;
  paid: number;
  balance: number;
  rateInfo?: {
    billingMode: string;
    catalogUnitPrice: number;
    unitPriceApplied?: number | null;
    appliedUnit: number;
    flatAmount?: number | null;
    plannedHours?: number | null;
    rateNote?: string | null;
    negotiated: boolean;
  } | null;
  nightBilling?: {
    nights: number;
    plannedNights: number;
    pastCheckoutHour: boolean;
    earlyDeparture: boolean;
    lateDeparture: boolean;
    checkoutHour: number;
  } | null;
};

/** Facture séjour / note de chambre (sections nuitées, conso, paiements, solde). */
export function StayFolioStatementView(props: {
  statement: StayFolioStatementViewModel;
  rate?: NormalizedUsdCdfRate | null;
  className?: string;
  compact?: boolean;
}) {
  const s = props.statement;
  const rate = props.rate;

  function money(amountUsd: number) {
    return formatPrimaryAmount(amountUsd, rate);
  }

  function moneySub(amountUsd: number) {
    return formatSecondaryAmount(amountUsd, rate);
  }

  return (
    <div className={cn("space-y-4 text-sm", props.className)}>
      <header className="space-y-0.5">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Client
        </p>
        <p className="text-lg font-bold tracking-tight">{s.guestName}</p>
        <p className="text-sm text-muted-foreground">
          Chambre {s.roomNumber}
          {" · "}
          Note de chambre
          {s.closed ? " · fermée" : " · ouverte"}
        </p>
        {rate ? (
          <p className="text-[11px] text-muted-foreground">
            Taux actif · {formatConfiguredRateLabel(rate)}
          </p>
        ) : null}
      </header>

      {s.rateInfo ? (
        <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs">
          {s.rateInfo.billingMode === "FLAT" ? (
            <>
              <p className="font-semibold">Passage</p>
              <p className="mt-0.5 text-muted-foreground">
                Durée {s.rateInfo.plannedHours ?? "—"} h · montant{" "}
                {money(s.rateInfo.flatAmount ?? s.rateInfo.appliedUnit)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Sans règle de sortie 10h — prolongation = même durée / même
                montant.
              </p>
            </>
          ) : (
            <>
              <p className="font-semibold">
                {s.rateInfo.negotiated
                  ? "Tarif nuitée négocié"
                  : "Tarif nuitée catalogue"}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Appliqué {money(s.rateInfo.appliedUnit)}/nuit
                {s.rateInfo.negotiated
                  ? ` · catalogue ${money(s.rateInfo.catalogUnitPrice)}/nuit`
                  : ""}
              </p>
            </>
          )}
          {s.rateInfo.rateNote ? (
            <p className="mt-1 text-muted-foreground">
              Motif · {s.rateInfo.rateNote}
            </p>
          ) : null}
        </div>
      ) : null}

      {s.nightBilling ? (
        <div
          className={cn(
            "rounded-xl border px-3 py-2.5 text-xs",
            s.nightBilling.lateDeparture
              ? "border-rose-500/35 bg-rose-500/10 text-rose-800 dark:text-rose-200"
              : s.nightBilling.earlyDeparture
                ? "border-amber-500/35 bg-amber-500/10 text-amber-900 dark:text-amber-100"
                : "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100",
          )}
        >
          <p className="font-semibold">
            {s.nightBilling.nights} nuit(s) consommée(s)
            {s.nightBilling.nights !== s.nightBilling.plannedNights
              ? ` · prévu ${s.nightBilling.plannedNights}`
              : ""}
          </p>
          <p className="mt-0.5 opacity-90">
            {s.nightBilling.lateDeparture
              ? `Sortie après ${s.nightBilling.checkoutHour}h — nuitée supplémentaire`
              : s.nightBilling.earlyDeparture
                ? `Départ anticipé — facturé selon les jours consommés (limite ${s.nightBilling.checkoutHour}h)`
                : `Sortie avant ${s.nightBilling.checkoutHour}h — nuitées selon le séjour`}
          </p>
        </div>
      ) : null}

      {s.sections.length === 0 ? (
        <p className="text-muted-foreground">Aucune ligne sur la note.</p>
      ) : (
        s.sections.map((section) => (
          <section key={section.kind} className="space-y-2">
            <div className="flex items-baseline justify-between gap-2 border-b border-border pb-1">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {section.label ||
                  FOLIO_SECTION_LABEL[
                    section.kind as keyof typeof FOLIO_SECTION_LABEL
                  ] ||
                  section.kind}
              </h3>
              <span className="text-right tabular-nums font-medium">
                <span className="block">{money(section.total)}</span>
                {moneySub(section.total) ? (
                  <span className="text-[11px] font-normal text-muted-foreground">
                    ≈ {moneySub(section.total)}
                  </span>
                ) : null}
              </span>
            </div>
            <ul className="space-y-1.5">
              {section.lines.map((line) => (
                <li
                  key={line.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
                >
                  <span className="min-w-0 truncate">{line.description}</span>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    ×{line.quantity}
                  </span>
                  <span className="text-right tabular-nums font-medium">
                    <span className="block">{money(line.amount)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {s.payments.length > 0 ? (
        <section className="space-y-2">
          <h3 className="border-b border-border pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Paiements / acomptes
          </h3>
          <ul className="space-y-1.5">
            {s.payments.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{p.receiptNumber}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.method}
                    {" · "}
                    {new Date(p.paidAt).toLocaleString("fr-FR")}
                    {p.note ? ` · ${p.note}` : ""}
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 text-right tabular-nums font-medium",
                    p.amountUsd < 0
                      ? "text-amber-700 dark:text-amber-400"
                      : "text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  <span className="block">
                    {p.amountUsd < 0
                      ? `Remb. ${money(Math.abs(p.amountUsd))}`
                      : `−${money(p.amountUsd)}`}
                  </span>
                  {moneySub(Math.abs(p.amountUsd)) ? (
                    <span className="text-[11px] font-normal text-muted-foreground">
                      ≈ {moneySub(Math.abs(p.amountUsd))}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <dl
        className={cn(
          "space-y-1.5 border-t border-border pt-3",
          props.compact ? "text-sm" : "text-base",
        )}
      >
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Total charges</dt>
          <dd className="text-right tabular-nums font-medium">
            <span className="block">{money(s.charges)}</span>
            {moneySub(s.charges) ? (
              <span className="text-xs font-normal text-muted-foreground">
                ≈ {moneySub(s.charges)}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-muted-foreground">Déjà payé</dt>
          <dd className="text-right tabular-nums font-medium">
            <span className="block">{money(s.paid)}</span>
            {moneySub(s.paid) ? (
              <span className="text-xs font-normal text-muted-foreground">
                ≈ {moneySub(s.paid)}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="flex justify-between gap-4 font-semibold">
          <dt>
            {s.balance < -0.01
              ? "Solde à rembourser"
              : s.balance > 0.01
                ? "Solde à encaisser"
                : "Solde"}
          </dt>
          <dd
            className={cn(
              "text-right tabular-nums",
              s.balance > 0.01
                ? "text-rose-600 dark:text-rose-400"
                : s.balance < -0.01
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-emerald-700 dark:text-emerald-400",
            )}
          >
            <span className="block">
              {s.balance < -0.01
                ? money(Math.abs(s.balance))
                : money(s.balance)}
            </span>
            {moneySub(Math.abs(s.balance)) ? (
              <span className="text-xs font-normal opacity-80">
                ≈ {moneySub(Math.abs(s.balance))}
              </span>
            ) : null}
          </dd>
        </div>
        {s.balance < -0.01 ? (
          <p className="text-xs font-normal text-amber-800 dark:text-amber-200">
            Trop-perçu : seules les nuitées consommées (règle{" "}
            {s.nightBilling?.checkoutHour ?? 10}h) restent dues — rembourser le
            reste en caisse.
          </p>
        ) : null}
      </dl>
    </div>
  );
}
