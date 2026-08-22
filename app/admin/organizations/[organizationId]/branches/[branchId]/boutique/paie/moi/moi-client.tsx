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
  const byDate = new Map(data.days.map((d) => [d.workDate, d]));

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
        subtitle={`${data.member.name} · ${data.member.dailyRateUsd.toFixed(2)} USD / jour · ${data.period.label}`}
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
          { label: "Déjà gagné", value: data.earnedUsd.toFixed(2), hint: "USD" },
          {
            label: "Avances",
            value: data.advancesUsd.toFixed(2),
            hint: "USD",
            tone: "warn",
          },
          {
            label: "Reste estimé",
            value: data.remainingUsd.toFixed(2),
            hint: "USD",
            tone: "money",
          },
        ]}
      />

      <BoutiquePanel title="Calendrier du mois" eyebrow="Jours ouvrés">
        <div className="p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
          {data.workYmds.map((ymd) => {
            const day = byDate.get(ymd);
            return (
              <div
                key={ymd}
                className={cn(
                  "rounded-xl border border-border bg-card p-2.5 text-xs",
                  day?.payTreatment === "UNPAID" && "border-rose-300 bg-rose-50",
                  day?.kind === "PRESENT" && "border-emerald-300 bg-emerald-50",
                )}
              >
                <p className="font-medium">{ymd.slice(8)}</p>
                <p className="text-muted-foreground">{day?.payLabel ?? "—"}</p>
                {day?.kind === "ABSENT" && day.payTreatment === "UNPAID" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 h-8 w-full"
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
          <div className="flex gap-2">
            <Input type="date" value={leaveStart} onChange={(e) => setLeaveStart(e.target.value)} />
            <Input type="date" value={leaveEnd} onChange={(e) => setLeaveEnd(e.target.value)} />
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
          <p className="text-sm text-muted-foreground">Aucun bulletin pour l’instant.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.payslips.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2">
                <span className="text-sm text-foreground">
                  {p.periodLabel} · {p.netUsd.toFixed(2)} USD
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className={boutiqueOutlineBtn("h-8")}
                  render={
                    <Link
                      href={boutiqueRoutes.paieBulletin(organizationId, branchId, p.id)}
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
