"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatYmdFr } from "@/lib/payroll/dates";
import { boutiquePrimaryBtn } from "@/components/boutique/boutique-shell";

type Data = Awaited<ReturnType<typeof import("@/lib/payroll/service").getPayslip>>;

export function BulletinView({ data }: { data: Data }) {
  const p = data.payslip;
  return (
    <div className="min-h-svh bg-background px-4 py-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-2xl print:max-w-none">
        <div className="mb-4 flex justify-end print:hidden">
          <Button
            type="button"
            className={boutiquePrimaryBtn()}
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            Imprimer
          </Button>
        </div>
        <article className="overflow-hidden rounded-[1.5rem] border border-[#e4ddd0] bg-white text-[#1c1917] shadow-[0_18px_40px_-24px_rgba(15,61,46,0.28)] print:rounded-none print:border-0 print:shadow-none">
          <div className="h-1.5 bg-gradient-to-r from-[#0f3d2e] via-[#c4a574] to-[#0f3d2e]" />
          <div className="px-7 py-8 sm:px-10">
            <header className="mb-8 flex items-start justify-between gap-4 border-b border-[#eee8dc] pb-6">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-[#9a7040] uppercase">
                  Bulletin de paie
                </p>
                <p className="mt-1 font-serif text-2xl font-semibold text-[#0f3d2e]">
                  {data.branchName}
                </p>
                <p className="text-sm text-[#6f675c]">{data.period.label}</p>
              </div>
              <p className="rounded-full bg-[#0f3d2e] px-3 py-1 text-[11px] font-semibold tracking-wide text-[#f4efe4]">
                Journalier
              </p>
            </header>

            <div className="mb-6 grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <span className="text-[#6f675c]">Agent</span>
                <br />
                <strong className="text-[#0f3d2e]">{p.agentName}</strong>
              </p>
              <p>
                <span className="text-[#6f675c]">Taux journalier</span>
                <br />
                <strong className="tabular-nums">{p.dailyRateUsd.toFixed(2)} USD</strong>
              </p>
              <p>
                <span className="text-[#6f675c]">Jours ouvrés</span>
                <br />
                <strong className="tabular-nums">{p.expectedDays}</strong>
              </p>
              <p>
                <span className="text-[#6f675c]">Taux clôturé</span>
                <br />
                <strong className="tabular-nums">
                  1 USD = {p.exchangeRateUsed.toLocaleString("fr-FR")} CDF
                </strong>
              </p>
            </div>

            {p.lines.days.filter((d) => d.payTreatment === "UNPAID").length > 0 ? (
              <div className="mb-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-800">
                <p className="mb-1 font-semibold">Absences non payées</p>
                <ul>
                  {p.lines.days
                    .filter((d) => d.payTreatment === "UNPAID")
                    .map((d) => (
                      <li key={d.date}>
                        {formatYmdFr(d.date)} · {d.label}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}

            <div className="space-y-2 border-t border-[#eee8dc] pt-5 text-sm tabular-nums">
              <p className="flex justify-between text-[#6f675c]">
                <span>Brut</span>
                <span>{p.grossUsd.toFixed(2)} USD</span>
              </p>
              <p className="flex justify-between text-rose-700">
                <span>− Absences non payées</span>
                <span>{p.absenceDeductionUsd.toFixed(2)} USD</span>
              </p>
              <p className="flex justify-between text-amber-800">
                <span>− Avances</span>
                <span>{p.advancesUsd.toFixed(2)} USD</span>
              </p>
              <p className="mt-3 flex justify-between border-t border-[#eee8dc] pt-3 font-serif text-xl font-semibold text-[#0f3d2e]">
                <span>Net à verser</span>
                <span>{p.netUsd.toFixed(2)} USD</span>
              </p>
              <p className="flex justify-between text-[#9a7040]">
                <span />
                <span>{Math.round(p.netCdf).toLocaleString("fr-FR")} CDF</span>
              </p>
            </div>

            {data.payoutHint ? (
              <p className="mt-8 rounded-2xl bg-[#faf8f4] px-4 py-3 text-sm text-[#4a453e]">
                Versement : {data.payoutHint}
              </p>
            ) : null}
          </div>
        </article>
      </div>
    </div>
  );
}
