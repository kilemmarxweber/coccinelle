import { Package, Warehouse } from "lucide-react";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { branchDashboardPath } from "@/lib/branch/paths";
import { listFactoryDepotAction } from "@/lib/factory/actions";
import {
  BoutiqueHero,
  BoutiqueKpis,
  BoutiquePage,
  BoutiquePanel,
} from "@/components/boutique/boutique-shell";
import { EmptyState } from "@/components/ui/empty-state";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

export default async function UsineDepotPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "usine",
    requireDashCard: DASH_CARD.USINE_DEPOT,
  });
  const products = await listFactoryDepotAction(organizationId, branchId);
  const finis = products.filter((p) => p.productKind === "FINISHED");
  const consos = products.filter((p) => p.productKind === "CONSUMABLE");
  const finisQty = finis.reduce((s, p) => s + p.stockQty, 0);
  const consosQty = consos.reduce((s, p) => s + p.stockQty, 0);

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker="Usine"
        title="Dépôt"
        subtitle="Produits finis issus de la production, et consommables entrés par bon de commande."
        icon={Warehouse}
        backHref={branchDashboardPath(organizationId, branchId)}
      />
      <BoutiqueKpis
        items={[
          {
            label: "Références finies",
            value: finis.length,
            hint: `${finisQty.toLocaleString("fr-FR")} en stock`,
          },
          {
            label: "Consommables",
            value: consos.length,
            hint: `${consosQty.toLocaleString("fr-FR")} en stock`,
          },
          {
            label: "Stock total",
            value: (finisQty + consosQty).toLocaleString("fr-FR"),
            tone: "money",
          },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <BoutiquePanel
          title="Dépôt production"
          eyebrow="Produits finis"
          icon={Package}
          bodyClassName="p-0"
        >
          {finis.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Aucun produit fini"
              description="Créez des articles eau / vins, puis validez un lot de production."
            />
          ) : (
            <ul className="divide-y divide-border">
              {finis.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.name}</p>
                    {p.finishedFamily ? (
                      <p className="text-[11px] text-muted-foreground">
                        {p.finishedFamily === "EAU" ? "Eau" : "Vins"}
                      </p>
                    ) : null}
                  </div>
                  <span className="rounded-lg bg-muted px-2.5 py-1 text-sm font-semibold tabular-nums">
                    {p.stockQty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </BoutiquePanel>
        <BoutiquePanel
          title="Dépôt consommables"
          eyebrow="Approvisionnement"
          icon={Package}
          bodyClassName="p-0"
        >
          {consos.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Aucun consommable"
              description="Les consommables arrivent via les bons de commande validés."
            />
          ) : (
            <ul className="divide-y divide-border">
              {consos.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <p className="min-w-0 truncate font-medium">{p.name}</p>
                  <span className="rounded-lg bg-muted px-2.5 py-1 text-sm font-semibold tabular-nums">
                    {p.stockQty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </BoutiquePanel>
      </div>
    </BoutiquePage>
  );
}
