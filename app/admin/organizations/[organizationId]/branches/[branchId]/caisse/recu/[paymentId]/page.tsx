import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { getPaymentByIdAction } from "@/lib/cash/actions";
import { branchCaissePath } from "@/lib/branch/paths";
import { PrintButton } from "./print-button";

type PageProps = {
  params: Promise<{
    organizationId: string;
    branchId: string;
    paymentId: string;
  }>;
};

export default async function ReceiptPage({ params }: PageProps) {
  const { organizationId, branchId, paymentId } = await params;
  const branch = await requireBranchContext({ organizationId, branchId });
  const payment = await getPaymentByIdAction(
    organizationId,
    branchId,
    paymentId,
  );
  if (!payment) notFound();

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="mb-4 flex gap-2 print:hidden">
        <PrintButton />
        <Button
          variant="outline"
          render={<Link href={branchCaissePath(organizationId, branchId)} />}
        >
          Retour caisse
        </Button>
      </div>

      <article className="rounded-2xl border border-border bg-card p-6 shadow-sm print:border-0 print:shadow-none">
        <header className="border-b border-border pb-4 text-center">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Coccinelle
          </p>
          <h1 className="text-xl font-bold">{branch.name}</h1>
          <p className="text-sm text-muted-foreground">Reçu de paiement</p>
        </header>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">N°</dt>
            <dd className="font-mono font-semibold">{payment.receiptNumber}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Date</dt>
            <dd>{new Date(payment.paidAt).toLocaleString("fr-FR")}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Mode</dt>
            <dd>{payment.method}</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-border pt-2 text-base">
            <dt className="font-semibold">Montant CDF</dt>
            <dd className="font-bold">{payment.amountCdf.toFixed(2)}</dd>
          </div>
          {payment.exchangeRateUsed != null ? (
            <>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Taux figé</dt>
                <dd>
                  1 {payment.foreignCurrency ?? "USD"} ={" "}
                  {payment.exchangeRateUsed} CDF
                </dd>
              </div>
              {payment.amountForeign != null ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">
                    Équiv. {payment.foreignCurrency}
                  </dt>
                  <dd>{payment.amountForeign.toFixed(2)}</dd>
                </div>
              ) : null}
            </>
          ) : null}
          {payment.note ? (
            <div className="pt-2 text-muted-foreground">{payment.note}</div>
          ) : null}
        </dl>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Merci · Conservez ce reçu
        </p>
      </article>
    </div>
  );
}
