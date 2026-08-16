import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { StayFolioStatementView } from "@/components/hotel/stay-folio-statement";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import { formatConfiguredRateLabel } from "@/lib/cash/exchange";
import { getStayFolioStatementAction } from "@/lib/hotel/actions";
import { PrintButton } from "@/app/admin/organizations/[organizationId]/branches/[branchId]/caisse/recu/[paymentId]/print-button";

type PageProps = {
  params: Promise<{
    organizationId: string;
    branchId: string;
    stayId: string;
  }>;
  searchParams: Promise<{ sign?: string }>;
};

export default async function StayNotePrintPage({
  params,
  searchParams,
}: PageProps) {
  const { organizationId, branchId, stayId } = await params;
  const sp = await searchParams;
  const forSignature = sp.sign === "1";

  await requireBranchContext({
    organizationId,
    branchId,
    requireModule: "hotel",
    requireHospitality: "stays",
    requireDashCard: DASH_CARD.SEJOURS,
  });

  let statement;
  try {
    statement = await getStayFolioStatementAction(
      organizationId,
      branchId,
      stayId,
    );
  } catch {
    notFound();
  }

  const rate = await getActiveExchangeRate(branchId);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="mb-4 flex gap-2 print:hidden">
        <PrintButton autoPrint={forSignature} />
        <Button
          variant="outline"
          render={
            <Link
              href={`/admin/organizations/${organizationId}/branches/${branchId}/hotel/sejours`}
            />
          }
        >
          Retour séjours
        </Button>
      </div>

      <article className="rounded-2xl border border-border bg-card p-6 shadow-sm print:border-0 print:shadow-none">
        <header className="mb-4 border-b border-border pb-4 text-center">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Coccinelle
          </p>
          <h1 className="text-xl font-bold">
            {forSignature ? "Facture générale séjour" : "Note de chambre"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {forSignature
              ? "Document à remettre au client pour signature"
              : "Facture séjour"}
          </p>
          {rate ? (
            <p className="mt-1 text-[11px] text-muted-foreground">
              {formatConfiguredRateLabel(rate)}
            </p>
          ) : null}
        </header>

        <StayFolioStatementView statement={statement} rate={rate} />

        {forSignature ? (
          <section className="mt-8 space-y-6 border-t border-border pt-6">
            <p className="text-center text-xs text-muted-foreground">
              Je reconnais avoir pris connaissance de la présente facture et
              n’avoir aucun solde à régler.
            </p>
            <div className="grid grid-cols-2 gap-6 pt-2">
              <div className="space-y-10">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Signature client
                </p>
                <div className="border-b border-foreground/40" />
                <p className="text-center text-xs text-muted-foreground">
                  {statement.guestName}
                </p>
              </div>
              <div className="space-y-10">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Signature réception
                </p>
                <div className="border-b border-foreground/40" />
                <p className="text-center text-xs text-muted-foreground">
                  Date · {new Date().toLocaleDateString("fr-FR")}
                </p>
              </div>
            </div>
          </section>
        ) : null}
      </article>
    </div>
  );
}
