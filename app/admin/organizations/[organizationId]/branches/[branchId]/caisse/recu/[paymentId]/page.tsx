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

type ReceiptLine = {
  key: string;
  label: string;
  quantity: number;
  unitPrice: number;
  amount: number;
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

  const lines: ReceiptLine[] = payment.order?.items?.length
    ? payment.order.items.map((item) => ({
        key: item.id,
        label: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.amount,
      }))
    : (payment.folio?.lines ?? []).map((line) => ({
        key: line.id,
        label: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
      }));

  const linesTotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const guestLabel = payment.folio?.stay
    ? `${payment.folio.stay.guestName} · ch. ${payment.folio.stay.room.number}`
    : payment.folio?.label ?? payment.order?.tableLabel ?? null;

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
          {guestLabel ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Réf.</dt>
              <dd className="text-right">{guestLabel}</dd>
            </div>
          ) : null}
        </dl>

        {lines.length > 0 ? (
          <section className="mt-5 border-t border-border pt-4">
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Articles
            </h2>
            <div className="mb-1.5 grid grid-cols-[1fr_2.5rem_4.5rem] gap-2 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
              <span>Article</span>
              <span className="text-center">Qté</span>
              <span className="text-right">Montant</span>
            </div>
            <ul className="space-y-1.5 text-sm">
              {lines.map((line) => (
                <li
                  key={line.key}
                  className="grid grid-cols-[1fr_2.5rem_4.5rem] items-center gap-2"
                >
                  <p className="min-w-0 truncate font-medium">{line.label}</p>
                  <p className="text-center tabular-nums text-muted-foreground">
                    {line.quantity}
                  </p>
                  <p className="text-right font-semibold tabular-nums">
                    {line.amount.toFixed(2)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between gap-4 border-t border-dashed border-border pt-3 text-sm">
              <span className="text-muted-foreground">Sous-total articles</span>
              <span className="font-medium tabular-nums">
                {linesTotal.toFixed(2)}
              </span>
            </div>
          </section>
        ) : null}

        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          <div className="flex justify-between gap-4 text-base">
            <dt className="font-semibold">Montant payé CDF</dt>
            <dd className="font-bold tabular-nums">
              {payment.amountCdf.toFixed(2)}
            </dd>
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
                  <dd className="tabular-nums">
                    {payment.amountForeign.toFixed(2)}
                  </dd>
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
