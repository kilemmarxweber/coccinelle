import Link from "next/link";
import {
  FileBarChart,
  FileText,
  LayoutDashboard,
  Package,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { branchDashboardPath, sharedBranchRoutes } from "@/lib/branch/paths";
import { requireBranchContext } from "@/lib/branch/require-branch-context";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

const LINKS = [
  {
    key: "tableauBord" as const,
    title: "Tableau de Bord",
    description: "Occupation, CA du jour et tickets F&B.",
    icon: LayoutDashboard,
  },
  {
    key: "ventes" as const,
    title: "Rapport Ventes",
    description: "CA, tickets, méthodes — graphs & comparaison de période.",
    icon: FileBarChart,
  },
  {
    key: "achats" as const,
    title: "Rapport Achats",
    description: "Entrées vs sorties stock, couverture et top produits.",
    icon: Package,
  },
  {
    key: "articles" as const,
    title: "Rapport Article",
    description: "Quantités vendues, catégories et sorties liées.",
    icon: FileBarChart,
  },
  {
    key: "financier" as const,
    title: "Rapport Financier",
    description: "Revenus croisés aux flux d’approvisionnements / décomptes.",
    icon: FileText,
  },
];

export default async function RapportsIndexPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });
  const hub = branchDashboardPath(organizationId, branchId);

  return (
    <div className="mx-auto flex min-h-svh max-w-2xl flex-col gap-6 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analyses & Rapports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Branche · {branch.name} — période, graphiques et comparaison vs
          période précédente.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {LINKS.map((item) => {
          const Icon = item.icon;
          const href = sharedBranchRoutes[item.key](organizationId, branchId);
          return (
            <li key={item.key}>
              <Link
                href={href}
                className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block font-semibold">{item.title}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {item.description}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Button variant="ghost" className="self-start" render={<Link href={hub} />}>
        ← Retour au dashboard
      </Button>
    </div>
  );
}
