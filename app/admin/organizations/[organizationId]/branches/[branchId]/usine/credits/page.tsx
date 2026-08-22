import Link from "next/link";
import { FilePlus, FileText } from "lucide-react";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { branchDashboardPath, usineRoutes } from "@/lib/branch/paths";
import { listFactoryCreditsAction } from "@/lib/factory/actions";
import { UsineCreditsClient } from "./credits-client";
import { Button } from "@/components/ui/button";
import {
  BoutiqueHero,
  BoutiqueKpis,
  BoutiquePage,
} from "@/components/boutique/boutique-shell";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function UsineCreditsPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.USINE_CREDITS,
  });
  const credits = await listFactoryCreditsAction(organizationId, branchId);
  const remaining = credits.reduce(
    (s, c) => s + Math.max(0, c.totalUsd - c.paidUsd),
    0,
  );
  const open = credits.filter(
    (c) => c.status === "OPEN" || c.status === "PARTIAL",
  ).length;
  const settled = credits.filter((c) => c.status === "SETTLED").length;

  return (
    <BoutiquePage wide>
      <BoutiqueHero
        kicker="Usine"
        title="Crédits"
        subtitle="Encaisser par acompte, complément ou solde. Prolonger l’échéance. Document à signer."
        icon={FileText}
        backHref={branchDashboardPath(organizationId, branchId)}
        actions={
          <Button
            render={
              <Link href={usineRoutes.creditNew(organizationId, branchId)} />
            }
          >
            <FilePlus className="size-4" />
            Nouvelle vente
          </Button>
        }
      />
      <BoutiqueKpis
        items={[
          { label: "Dossiers", value: credits.length },
          { label: "Ouverts", value: open, tone: open ? "warn" : "ok" },
          { label: "Soldés", value: settled, tone: "ok" },
          {
            label: "Restant dû",
            value: `${remaining.toFixed(0)} $`,
            tone: "money",
          },
        ]}
      />
      <UsineCreditsClient
        organizationId={organizationId}
        branchId={branchId}
        credits={credits}
      />
    </BoutiquePage>
  );
}
