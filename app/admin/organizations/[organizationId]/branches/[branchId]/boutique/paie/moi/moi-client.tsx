"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { branchDashboardPath, boutiqueRoutes } from "@/lib/branch/paths";
import {
  markNotifiedAbsenceAction,
  requestAdvanceAction,
  requestLeaveAction,
  submitJustificationAction,
} from "@/lib/payroll/actions";
import type { PayrollCapabilities } from "@/lib/payroll/types";
import type { WorkdayUiStatus } from "@/lib/payroll/engine";
import { PaieSectionNav } from "../paie-nav";
import {
  BoutiqueHero,
  BoutiqueKpis,
  BoutiquePage,
  BoutiquePanel,
  boutiqueOutlineBtn,
  boutiquePrimaryBtn,
} from "@/components/boutique/boutique-shell";
import { cn } from "@/lib/utils";

type Data = Awaited<
  ReturnType<typeof import("@/lib/payroll/service").getSelfPayload>
>;

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  data: Data;
  caps: PayrollCapabilities;
};

function dayToneClass(status: WorkdayUiStatus): string {
  switch (status) {
    case "PRESENT":
      return "border-emerald-400 bg-emerald-50 text-emerald-950 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-50";
    case "ABSENT_UNPAID":
    case "ABSENT_MISSING":
      return "border-rose-400 bg-rose-50 text-rose-950 dark:border-rose-700 dark:bg-rose-950/50 dark:text-rose-50";
    case "ABSENT_JUSTIFIED":
      return "border-teal-400 bg-teal-50 text-teal-950 dark:border-teal-700 dark:bg-teal-950/40 dark:text-teal-50";
    case "ABSENT_PENDING":
      return "border-orange-400 bg-orange-50 text-orange-950 dark:border-orange-700 dark:bg-orange-950/40";
    case "NOTIFIED":
      return "border-amber-400 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40";
    case "LEAVE":
      return "border-sky-400 bg-sky-50 text-sky-950 dark:border-sky-700 dark:bg-sky-950/40";
    case "FUTURE":
      return "border-dashed border-border bg-muted/30 text-muted-foreground";
    case "REST":
      return "border-border bg-muted/40 text-muted-foreground";
    default:
      return "border-border bg-card";
  }
}

const LEGEND: { status: WorkdayUiStatus; label: string }[] = [
  { status: "PRESENT", label: "Présent" },
  { status: "ABSENT_UNPAID", label: "Absent / non pointé (−)" },
  { status: "LEAVE", label: "Congé (payé)" },
  { status: "NOTIFIED", label: "Prévenu (payé)" },
  { status: "ABSENT_JUSTIFIED", label: "Excuse acceptée" },
  { status: "ABSENT_PENDING", label: "Justificatif en cours" },
  { status: "FUTURE", label: "À venir" },
];

export function MoiClient({
  organizationId,
  branchId,
  branchName,
  data,
  caps,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [advance, setAdvance] = useState("");

  function run(fn: () => Promise<unknown>, ok: string) {
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
        kicker={`${branchName} · mon dossier`}
        title="Mes jours"
        subtitle={`${data.member.name} · ${data.member.dailyRateUsd.toFixed(2)} USD / jour · ${data.period.label} · ${data.expectedDaysMonth} jours ouvrés`}
        icon={UserRound}
        backHref={branchDashboardPath(organizationId, branchId)}
        nav={
          <PaieSectionNav
            organizationId={organizationId}
            branchId={branchId}
            active="moi"
            showManage={caps.canManage}
            showPoint={caps.canPoint}
          />
        }
      />

      <BoutiqueKpis
        items={[
          {
            label: "Déjà gagné",
            value: data.earnedUsd.toFixed(2),
            hint: `${data.paidDaysToDate}/${data.expectedDaysToDate} j. payés`,
          },
          {
            label: "Absences (−)",
            value: data.absenceDeductionUsd.toFixed(2),
            hint: `${data.unpaidOpen} j. coupés`,
            tone: data.unpaidOpen > 0 ? "warn" : undefined,
          },
          {
            label: "Avances",
            value: data.advancesUsd.toFixed(2),
            hint: "USD",
            tone: "warn",
          },
          {
            label: "Reste estimé",
            value: data.remainingUsd.toFixed(2),
            hint: `brut ${data.grossUsd.toFixed(0)} $`,
            tone: "money",
          },
        ]}
      />

      <BoutiquePanel title="Calendrier du mois" eyebrow="Jours ouvrés">
        <div className="p-4">
          <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
            {LEGEND.map((item) => (
              <span
                key={item.status}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5",
                  dayToneClass(item.status),
                )}
              >
                <span className="font-medium">{item.label}</span>
              </span>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
            {data.calendar.map((cell) => {
              const day = cell.day;
              return (
                <div
                  key={cell.ymd}
                  className={cn(
                    "rounded-xl border p-2.5 text-xs",
                    dayToneClass(cell.status),
                  )}
                >
                  <p className="font-semibold tabular-nums">
                    {cell.ymd.slice(8)}
                    {cell.ymd === data.todayYmd ? (
                      <span className="ml-1 text-[10px] font-normal opacity-80">
                        · auj.
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 font-medium">{cell.statusLabel}</p>
                  <p className="opacity-80">{cell.payLabel}</p>
                  {day?.kind === "ABSENT" &&
                  day.payTreatment === "UNPAID" &&
                  day.justificationStatus !== "PENDING" &&
                  day.justificationStatus !== "ACCEPTED" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-8 w-full border-current/30 bg-background/60"
                      disabled={pending || !note.trim()}
                      onClick={() =>
                        run(
                          () =>
                            submitJustificationAction({
                              organizationId,
                              branchId,
                              attendanceId: day.id,
                              note,
                            }),
                          "Justificatif envoyé.",
                        )
                      }
                    >
                      Justifier
                    </Button>
                  ) : null}
                  {cell.status === "ABSENT_MISSING" ? (
                    <p className="mt-1 text-[10px] opacity-70">
                      Pointez ou demandez un congé / préavis
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="mt-3 grid gap-1.5">
            <Label htmlFor="justif">Motif (justificatif / congé)</Label>
            <Textarea
              id="justif"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
            />
          </div>
        </div>
      </BoutiquePanel>

      <div className="grid gap-4 sm:grid-cols-2">
        <BoutiquePanel title="Prévenir une absence / congé" eyebrow="Demandes">
          <div className="flex flex-col gap-2 p-4">
            <p className="text-xs text-muted-foreground">
              Congé ou préavis = jour payé (pas de coupe). Absence non justifiée
              = −{data.member.dailyRateUsd.toFixed(2)} USD.
            </p>
            <div className="flex gap-2">
              <Input
                type="date"
                value={leaveStart}
                onChange={(e) => setLeaveStart(e.target.value)}
              />
              <Input
                type="date"
                value={leaveEnd}
                onChange={(e) => setLeaveEnd(e.target.value)}
              />
            </div>
            <Button
              disabled={pending || !leaveStart || !leaveEnd}
              className={boutiquePrimaryBtn()}
              onClick={() =>
                run(
                  () =>
                    requestLeaveAction({
                      organizationId,
                      branchId,
                      startYmd: leaveStart,
                      endYmd: leaveEnd,
                      note,
                    }),
                  "Demande de congé envoyée.",
                )
              }
            >
              Demander un congé
            </Button>
            <Button
              variant="outline"
              className={boutiqueOutlineBtn()}
              disabled={pending || !leaveStart}
              onClick={() =>
                run(
                  () =>
                    markNotifiedAbsenceAction({
                      organizationId,
                      branchId,
                      branchMemberId: data.member.branchMemberId,
                      workYmd: leaveStart,
                    }),
                  "Préavis enregistré.",
                )
              }
            >
              Prévenir pour le jour (date début)
            </Button>
          </div>
        </BoutiquePanel>
        <BoutiquePanel
          title={`Avance (plafond ${data.advanceCapUsd.toFixed(2)} USD)`}
          eyebrow="Acompte"
        >
          <div className="flex flex-col gap-2 p-4">
            <Input
              type="number"
              min="0"
              step="1"
              value={advance}
              onChange={(e) => setAdvance(e.target.value)}
              placeholder="Montant USD"
            />
            <Button
              disabled={pending || !advance}
              className={boutiquePrimaryBtn()}
              onClick={() =>
                run(
                  () =>
                    requestAdvanceAction({
                      organizationId,
                      branchId,
                      amountUsd: Number(advance),
                    }),
                  "Demande d’avance envoyée.",
                )
              }
            >
              Demander une avance
            </Button>
            <ul className="text-xs text-muted-foreground">
              {data.advances.map((a) => (
                <li key={a.id}>
                  {a.amountUsd.toFixed(2)} USD · {a.status}
                </li>
              ))}
            </ul>
          </div>
        </BoutiquePanel>
      </div>

      <BoutiquePanel title="Bulletins" eyebrow="Documents">
        <div className="p-4">
          {data.payslips.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucun bulletin pour l’instant.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {data.payslips.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="text-sm text-foreground">
                    {p.periodLabel} · {p.netUsd.toFixed(2)} USD
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className={boutiqueOutlineBtn("h-8")}
                    render={
                      <Link
                        href={boutiqueRoutes.paieBulletin(
                          organizationId,
                          branchId,
                          p.id,
                        )}
                      />
                    }
                  >
                    Lire
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </BoutiquePanel>
    </BoutiquePage>
  );
}
