"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Activity,
  ClipboardCheck,
  Coffee,
  Landmark,
  LayoutDashboard,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DashboardMenuCard,
  DashboardSection,
} from "@/components/ui/dashboard-menu-card";
import {
  enableCafeYayoAction,
  getOrgYayoStateAction,
} from "@/lib/org/yayo-actions";

export function YayoPilotage({ organizationId }: { organizationId: string }) {
  const base = `/admin/organizations/${organizationId}`;
  const [cafeYayo, setCafeYayo] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    void getOrgYayoStateAction(organizationId).then((res) => {
      if (res.ok) setCafeYayo(res.cafeYayo);
      setLoaded(true);
    });
  }, [organizationId]);

  function toggle(enabled: boolean) {
    start(async () => {
      try {
        const res = await enableCafeYayoAction({
          organizationId,
          enabled,
          seedDepartments: true,
        });
        setCafeYayo(enabled);
        toast.success(
          enabled
            ? `CAFE YAYO activé${res.seeded.length ? ` · ${res.seeded.length} département(s) créé(s)` : ""}`
            : "Profil campus désactivé",
        );
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  if (!loaded) return null;

  return (
    <DashboardSection
      title="CAFE YAYO"
      titleColor="text-amber-500"
      icon={Coffee}
      iconColor="text-amber-500"
    >
      <div className="col-span-full mb-2 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          {cafeYayo
            ? "Campus universitaire : départements, caisse centrale, audit et tableau PCA."
            : "Activez le profil campus pour restreindre les types (sans voyage ni chambres) et créer les 6 départements du cahier des charges."}
        </p>
        <Button
          type="button"
          size="sm"
          variant={cafeYayo ? "outline" : "default"}
          className="h-11 min-w-40"
          disabled={pending}
          onClick={() => toggle(!cafeYayo)}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : cafeYayo ? (
            "Désactiver le profil"
          ) : (
            "Activer CAFE YAYO"
          )}
        </Button>
      </div>
      {cafeYayo ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardMenuCard
            href={`${base}/pca`}
            title="Tableau de bord PCA"
            description="Ventes du jour, écarts, alertes, objectifs par département."
            icon={LayoutDashboard}
            iconBg="bg-amber-500/15"
            iconColor="text-amber-500"
            primary
          />
          <DashboardMenuCard
            href={`${base}/caisse-centrale`}
            title="Caisse centrale"
            description="Versements, accusé unique, journal du coffre."
            icon={Landmark}
            iconBg="bg-emerald-500/15"
            iconColor="text-emerald-400"
          />
          <DashboardMenuCard
            href={`${base}/audit`}
            title="Audit interne"
            description="Lecture seule : créations, corrections, motifs."
            icon={ClipboardCheck}
            iconBg="bg-sky-500/15"
            iconColor="text-sky-400"
          />
          <DashboardMenuCard
            href={`${base}/bia`}
            title="BIA Enterprise"
            description="Santé PostgreSQL, constats d'intégrité et incidents. Aucune correction automatique."
            icon={Activity}
            iconBg="bg-emerald-500/15"
            iconColor="text-emerald-500"
          />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Documentation backup / hors-ligne :{" "}
          <Link className="underline" href={`${base}/pca`}>
            après activation
          </Link>
          .
        </p>
      )}
    </DashboardSection>
  );
}
