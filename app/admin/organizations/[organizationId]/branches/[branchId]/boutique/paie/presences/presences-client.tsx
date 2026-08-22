"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { branchDashboardPath } from "@/lib/branch/paths";
import {
  markAttendanceAction,
  markNotifiedAbsenceAction,
  markTeamPresentAction,
} from "@/lib/payroll/actions";
import type { AttendanceKind, PayrollCapabilities } from "@/lib/payroll/types";
import { PaieSectionNav } from "../paie-nav";
import {
  BoutiqueHero,
  BoutiquePage,
  BoutiquePanel,
  BoutiqueStatus,
  boutiqueOutlineBtn,
  boutiquePrimaryBtn,
} from "@/components/boutique/boutique-shell";
import { cn } from "@/lib/utils";

type Agent = {
  branchMemberId: string;
  name: string;
  opsRole: string;
  profile: { effectiveDailyRateUsd: number };
  attendance: {
    kind: AttendanceKind;
    payTreatment: string;
    payLabel: string;
    justificationStatus: string | null;
  } | null;
};

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  timezone: string;
  ymd: string;
  isWorkday: boolean;
  periodStatus: string;
  agents: Agent[];
  caps: PayrollCapabilities;
};

const KINDS: { id: AttendanceKind; label: string }[] = [
  { id: "PRESENT", label: "Présent" },
  { id: "ABSENT", label: "Absent" },
  { id: "ABSENT_NOTIFIED", label: "Prévenu" },
  { id: "LEAVE", label: "Congé" },
  { id: "REST", label: "Repos" },
];

function kindTone(kind: AttendanceKind | undefined) {
  switch (kind) {
    case "PRESENT":
      return "ok" as const;
    case "ABSENT":
      return "danger" as const;
    case "ABSENT_NOTIFIED":
      return "warn" as const;
    case "LEAVE":
      return "info" as const;
    default:
      return "neutral" as const;
  }
}

export function PresencesClient({
  organizationId,
  branchId,
  branchName,
  ymd,
  isWorkday,
  periodStatus,
  agents,
  caps,
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const locked = periodStatus === "LOCKED" || periodStatus === "PAID";

  function goDay(next: string) {
    router.push(
      `${branchDashboardPath(organizationId, branchId)}/boutique/paie/presences?jour=${next}`,
    );
  }

  function mark(branchMemberId: string, kind: AttendanceKind) {
    start(async () => {
      try {
        if (kind === "ABSENT_NOTIFIED") {
          await markNotifiedAbsenceAction({
            organizationId,
            branchId,
            branchMemberId,
            workYmd: ymd,
          });
        } else {
          await markAttendanceAction({
            organizationId,
            branchId,
            branchMemberId,
            workYmd: ymd,
            kind,
          });
        }
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action impossible.");
      }
    });
  }

  function allPresent() {
    start(async () => {
      try {
        await markTeamPresentAction({ organizationId, branchId, workYmd: ymd });
        toast.success("Équipe marquée présente.");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action impossible.");
      }
    });
  }

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker={`${branchName} · pointage`}
        title="Présences du jour"
        subtitle={
          isWorkday
            ? "Jour ouvré — chaque pastille met à jour la paie du jour."
            : "Jour de repos — hors brut, aucune coupe."
        }
        icon={CalendarDays}
        backHref={branchDashboardPath(organizationId, branchId)}
        actions={
          <>
            <Input
              type="date"
              value={ymd}
              onChange={(e) => e.target.value && goDay(e.target.value)}
              className="h-10 w-auto rounded-full border-border bg-card"
            />
            <Button
              type="button"
              onClick={allPresent}
              disabled={pending || locked || !isWorkday}
              className={boutiquePrimaryBtn("h-10")}
            >
              <CheckCheck className="size-4" />
              Tous présents
            </Button>
          </>
        }
        nav={
          <PaieSectionNav
            organizationId={organizationId}
            branchId={branchId}
            active="presences"
            showManage={caps.canManage}
            showPoint={caps.canPoint}
          />
        }
      />

      <BoutiquePanel title="Équipe" eyebrow={ymd}>
        <ul>
          {agents.map((a, i) => (
            <li
              key={a.branchMemberId}
              className={cn(
                "flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between",
                i > 0 && "border-t border-border",
              )}
            >
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.profile.effectiveDailyRateUsd.toFixed(2)} USD / jour
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <BoutiqueStatus tone={kindTone(a.attendance?.kind)}>
                  {a.attendance?.payLabel ?? "Non pointé"}
                </BoutiqueStatus>
                {KINDS.map((k) => (
                  <Button
                    key={k.id}
                    type="button"
                    size="sm"
                    variant={a.attendance?.kind === k.id ? "default" : "outline"}
                    className={
                      a.attendance?.kind === k.id
                        ? boutiquePrimaryBtn("h-9")
                        : boutiqueOutlineBtn("h-9")
                    }
                    disabled={pending || locked}
                    onClick={() => mark(a.branchMemberId, k.id)}
                  >
                    {k.label}
                  </Button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </BoutiquePanel>
    </BoutiquePage>
  );
}
