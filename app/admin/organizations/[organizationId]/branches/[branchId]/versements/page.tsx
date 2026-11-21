import Link from "next/link";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { branchCaissePath } from "@/lib/branch/paths";
import prisma from "@/lib/prisma";

type PageProps = {
  params: Promise<{ organizationId: string; branchId: string }>;
};

const STATUS: Record<string, string> = {
  PREPARED: "Préparé",
  RECEIVED: "Reçu",
  DISPUTED: "En écart",
};

export default async function VersementsPage({ params }: PageProps) {
  const { organizationId, branchId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });
  const rows = await prisma.cashRemittance.findMany({
    where: { fromBranchId: branchId },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      id: true,
      number: true,
      status: true,
      expectedUsd: true,
      declaredUsd: true,
      createdAt: true,
    },
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Versements</h1>
          <p className="text-sm text-muted-foreground">
            Caisse de {branch.name} vers la caisse centrale. Les autres
            départements n&apos;apparaissent pas ici.
          </p>
        </div>
        <Link
          href={branchCaissePath(organizationId, branchId)}
          className="inline-flex h-9 items-center rounded-lg bg-[#0f172a] px-3 text-sm font-medium text-white"
        >
          Préparer depuis la caisse
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card px-4 py-16 text-center text-sm text-muted-foreground">
          Aucun versement préparé pour ce département.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3"
            >
              <div>
                <p className="font-medium">{row.number}</p>
                <p className="text-xs text-muted-foreground">
                  {row.createdAt.toLocaleString("fr-FR", {
                    timeZone: "Africa/Kinshasa",
                  })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">
                  {row.expectedUsd.toFixed(2)} $
                </p>
                <p className="text-xs text-muted-foreground">
                  {STATUS[row.status] ?? row.status}
                  {row.declaredUsd != null
                    ? ` · déclaré ${row.declaredUsd.toFixed(2)} $`
                    : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
