"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, ClipboardCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { branchDashboardPath, boutiqueRoutes } from "@/lib/branch/paths";
import {
  BoutiqueHero,
  BoutiqueKpis,
  BoutiquePage,
  BoutiquePanel,
  BoutiqueStatus,
  boutiqueOutlineBtn,
  boutiquePrimaryBtn,
} from "@/components/boutique/boutique-shell";
import {
  lockPayrollAction,
  payAdvanceAction,
  payPayrollAction,
  preparePayrollAction,
  reviewAdvanceAction,
  reviewJustificationAction,
  reviewLeaveAction,
} from "@/lib/payroll/actions";
import type { PayrollCapabilities } from "@/lib/payroll/types";
import { PaieSectionNav } from "./paie-nav";
import { cn } from "@/lib/utils";

function periodTone(status: string) {
  if (status === "PAID") return "gold" as const;
  if (status === "LOCKED") return "info" as const;
  if (status === "REVIEW") return "warn" as const;
  return "ok" as const;
}

type Data = Awaited<
  ReturnType<typeof import("@/lib/payroll/service").getMonthPayload>
>;

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  data: Data;
  caps: PayrollCapabilities;
};

export function PaieMoisClient({
  organizationId,
  branchId,
  branchName,
  data,
  caps,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { period, agents } = data;
  const totals = agents.reduce(
    (acc, a) => {
      acc.gross += a.grossUsd;
      acc.abs += a.absenceDeductionUsd;
      acc.adv += a.advancesUsd;
      acc.net += a.netUsd;
      return acc;
    },
    { gross: 0, abs: 0, adv: 0, net: 0 },
  );

  function run(fn: () => Promise<void>, ok: string) {
    start(async () => {
      try {
        await fn();
        toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action impossible.");
      }
    });
  }

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker={`${branchName} · paie commerce`}
        title={period.label}
        subtitle={
          period.exchangeRateUsed
            ? `1 USD = ${period.exchangeRateUsed.toLocaleString("fr-FR")} CDF à la clôture`
            : "Taux figé à la clôture des bulletins"
        }
        icon={Banknote}
        backHref={branchDashboardPath(organizationId, branchId)}
        actions={
          <>
            <BoutiqueStatus tone={periodTone(period.status)}>
              {period.status}
            </BoutiqueStatus>
            {period.status === "OPEN" ? (
              <Button
                disabled={pending}
                className={boutiqueOutlineBtn()}
                onClick={() =>
                  run(
                    () =>
                      preparePayrollAction({
                        organizationId,
                        branchId,
                        periodId: period.id,
                      }),
                    "Période en revue.",
                  )
                }
              >
                Préparer
              </Button>
            ) : null}
            {period.status === "OPEN" || period.status === "REVIEW" ? (
              <Button
                disabled={pending}
                className={boutiquePrimaryBtn()}
                onClick={() =>
                  run(
                    () =>
                      lockPayrollAction({
                        organizationId,
                        branchId,
                        periodId: period.id,
                      }),
                    "Bulletins générés.",
                  )
                }
              >
                Clôturer
              </Button>
            ) : null}
            {period.status === "LOCKED" ? (
              <Button
                disabled={pending}
                className={boutiquePrimaryBtn()}
                onClick={() =>
                  run(
                    () =>
                      payPayrollAction({
                        organizationId,
                        branchId,
                        periodId: period.id,
                      }),
                    "Salaires versés.",
                  )
                }
              >
                Verser tout
              </Button>
            ) : null}
          </>
        }
        nav={
          <PaieSectionNav
            organizationId={organizationId}
            branchId={branchId}
            active="mois"
            showManage={caps.canManage}
            showPoint={caps.canPoint}
          />
        }
      />

      <BoutiqueKpis
        items={[
          {
            label: "Brut",
            value: `${totals.gross.toFixed(2)}`,
            hint: "USD · jours ouvrés",
          },
          {
            label: "Absences",
            value: `−${totals.abs.toFixed(2)}`,
            hint: "non justifiées",
            tone: "danger",
          },
          {
            label: "Avances",
            value: `−${totals.adv.toFixed(2)}`,
            hint: "déjà versées",
            tone: "warn",
          },
          {
            label: "Net à verser",
            value: `${totals.net.toFixed(2)}`,
            hint: "USD",
            tone: "money",
          },
        ]}
      />

      <BoutiquePanel title="Agents" eyebrow="Masse salariale">
        <ul>
          {agents.map((a, i) => (
            <li
              key={a.branchMemberId}
              className={cn(
                "grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center",
                i > 0 && "border-t border-[#eee8dc]",
              )}
            >
              <div>
                <p className="font-semibold text-[#0f3d2e]">{a.name}</p>
                <p className="mt-0.5 text-xs text-[#6f675c]">
                  {a.expectedDays} ouvrés · {a.presentDays} présents · {a.leaveDays}{" "}
                  congés · {a.justifiedDays} justifiés · {a.unpaidDays} non payés
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-sm tabular-nums">
                <span className="text-[#6f675c]">{a.grossUsd.toFixed(2)}</span>
                <span className="text-rose-700">−{a.absenceDeductionUsd.toFixed(2)}</span>
                <span className="text-amber-800">−{a.advancesUsd.toFixed(2)}</span>
                <span className="font-serif text-base font-semibold text-[#0f3d2e]">
                  {a.netUsd.toFixed(2)} USD
                </span>
                {a.payslip ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className={boutiqueOutlineBtn("h-8")}
                    render={
                      <Link
                        href={boutiqueRoutes.paieBulletin(
                          organizationId,
                          branchId,
                          a.payslip.id,
                        )}
                      />
                    }
                  >
                    Bulletin
                  </Button>
                ) : null}
                {!a.payoutReady ? (
                  <BoutiqueStatus tone="warn">Coordonnées manquantes</BoutiqueStatus>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </BoutiquePanel>

      {data.pendingJustifications.length > 0 ? (
        <BoutiquePanel
          title="Justificatifs à traiter"
          eyebrow="Exceptions"
          icon={ClipboardCheck}
          tint="rose"
        >
          <ul className="divide-y divide-[#eee8dc]">
            {data.pendingJustifications.map((d) => {
              const agent = agents.find((a) => a.branchMemberId === d.branchMemberId);
              return (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <p className="text-sm">
                    {agent?.name} · {d.workDate}
                    {d.justificationNote ? ` — ${d.justificationNote}` : ""}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            reviewJustificationAction({
                              organizationId,
                              branchId,
                              attendanceId: d.id,
                              accept: true,
                            }).then(() => undefined),
                          "Justificatif accepté.",
                        )
                      }
                    >
                      Accepter
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            reviewJustificationAction({
                              organizationId,
                              branchId,
                              attendanceId: d.id,
                              accept: false,
                            }).then(() => undefined),
                          "Justificatif refusé.",
                        )
                      }
                    >
                      Refuser
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </BoutiquePanel>
      ) : null}

      {data.leaves.filter((l) => l.status === "REQUESTED").length > 0 ? (
        <BoutiquePanel title="Congés à approuver" eyebrow="Planning" icon={Wallet} tint="mint">
          <ul className="divide-y divide-[#eee8dc]">
            {data.leaves
              .filter((l) => l.status === "REQUESTED")
              .map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <p className="text-sm">
                    {l.agentName} · {l.startDate} → {l.endDate}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            reviewLeaveAction({
                              organizationId,
                              branchId,
                              leaveId: l.id,
                              accept: true,
                            }),
                          "Congé approuvé.",
                        )
                      }
                    >
                      Approuver
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        run(
                          () =>
                            reviewLeaveAction({
                              organizationId,
                              branchId,
                              leaveId: l.id,
                              accept: false,
                            }),
                          "Congé refusé.",
                        )
                      }
                    >
                      Refuser
                    </Button>
                  </div>
                </li>
              ))}
          </ul>
        </BoutiquePanel>
      ) : null}

      {data.advances.filter((a) => a.status === "REQUESTED" || a.status === "APPROVED").length >
      0 ? (
        <BoutiquePanel title="Avances" eyebrow="Acomptes" icon={Wallet} tint="amber">
          <ul className="divide-y divide-[#eee8dc]">
            {data.advances
              .filter((a) => a.status === "REQUESTED" || a.status === "APPROVED")
              .map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <p className="text-sm">
                    {a.agentName} · {a.amountUsd.toFixed(2)} USD · {a.status}
                  </p>
                  <div className="flex gap-2">
                    {a.status === "REQUESTED" ? (
                      <>
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () =>
                                reviewAdvanceAction({
                                  organizationId,
                                  branchId,
                                  advanceId: a.id,
                                  accept: true,
                                }),
                              "Avance approuvée.",
                            )
                          }
                        >
                          Approuver
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () =>
                                reviewAdvanceAction({
                                  organizationId,
                                  branchId,
                                  advanceId: a.id,
                                  accept: false,
                                }),
                              "Avance refusée.",
                            )
                          }
                        >
                          Refuser
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        disabled={pending}
                        onClick={() =>
                          run(
                            () =>
                              payAdvanceAction({
                                organizationId,
                                branchId,
                                advanceId: a.id,
                              }),
                            "Avance versée.",
                          )
                        }
                      >
                        Verser
                      </Button>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </BoutiquePanel>
      ) : null}
    </BoutiquePage>
  );
}
