import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { requireBranchContext } from "@/lib/branch/require-branch-context";
import { isHospitality } from "@/lib/branch/hospitality";
import { getPaymentByIdAction } from "@/lib/cash/actions";
import {
  branchCaissePath,
  boutiqueRoutes,
} from "@/lib/branch/paths";
import { FOLIO_SECTION_LABEL } from "@/lib/hotel/folio-note";
import { paymentAmountUsd } from "@/lib/hotel/money";
import {
  formatConfiguredRateLabel,
  formatUsdLineTotal,
  formatUsdLinesTotal,
  isCdfPrimary,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";
import { getActiveExchangeRate } from "@/lib/cash/actions";
import type { FolioLineKind } from "@/prisma/generated/prisma/client";
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
  kind?: FolioLineKind;
  wasPromo?: boolean;
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
  const exchange = await getActiveExchangeRate(branchId);
  const moneyRate: Pick<
    NormalizedUsdCdfRate,
    "rate" | "configuredFrom" | "configuredTo" | "configuredRate"
  > | null = exchange
    ? {
        rate: exchange.rate,
        configuredFrom: exchange.configuredFrom,
        configuredTo: exchange.configuredTo,
        configuredRate: exchange.configuredRate,
      }
    : null;

  const isShopReceipt = Boolean(payment.shopSaleId && payment.shopSale);
  const isFolioReceipt = Boolean(payment.folioId && !payment.orderId && !isShopReceipt);
  const isPharmacy = branch.type === "BOUTIQUE" && branch.hasPharmacie;

  const lines: ReceiptLine[] = payment.shopSale?.items?.length
    ? payment.shopSale.items.map((item) => ({
        key: item.id,
        label: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        amount: item.unitPrice * item.quantity,
        wasPromo: item.wasPromo,
      }))
    : payment.order?.items?.length
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
          kind: line.kind,
        }));

  const kindOrder: FolioLineKind[] = [
    "NIGHT",
    "STAY_FLAT",
    "STAY_OVERTIME",
    "FNB",
    "PRODUCT",
    "TAX",
    "OTHER",
  ];
  const folioSections = isFolioReceipt
    ? kindOrder
        .map((kind) => {
          const sectionLines = lines.filter((l) => l.kind === kind);
          if (!sectionLines.length) return null;
          return {
            kind,
            label: FOLIO_SECTION_LABEL[kind],
            lines: sectionLines,
            total: sectionLines.reduce((s, l) => s + l.amount, 0),
          };
        })
        .filter((s): s is NonNullable<typeof s> => s != null)
    : [];

  const shopClient =
    payment.shopSale == null
      ? null
      : payment.shopSale.isAnonymous
        ? payment.shopSale.anonymousCode
        : payment.shopSale.clientLabel ||
          payment.shopSale.clientPhone ||
          null;
  const guestLabel = isShopReceipt
    ? shopClient
    : payment.folio?.stay
      ? `${payment.folio.stay.guestName} · ch. ${payment.folio.stay.room.number}`
      : payment.folio?.label ?? payment.order?.tableLabel ?? null;
  const serverName = payment.order?.createdByName ?? null;
  const isHospitalityBranch = isHospitality(branch.type);
  const cdfPrimary = isCdfPrimary(moneyRate);
  const linesTotalUsd = lines.reduce((sum, line) => sum + line.amount, 0);
  const linesTotalLabel =
    isHospitalityBranch && !isShopReceipt
      ? formatUsdLinesTotal(
          lines.map((l) => ({
            quantity: l.quantity,
            unitPriceUsd: l.unitPrice,
          })),
          moneyRate,
        )
      : `${linesTotalUsd.toFixed(2)}${isHospitalityBranch || isShopReceipt ? " $" : ""}`;
  const frozenRate =
    payment.exchangeRateUsed != null && payment.exchangeRateUsed > 0
      ? Math.round(payment.exchangeRateUsed)
      : moneyRate?.rate
        ? Math.round(moneyRate.rate)
        : null;
  const rateLabelForReceipt =
    frozenRate != null
      ? moneyRate
        ? formatConfiguredRateLabel({
            ...moneyRate,
            rate: frozenRate,
            configuredRate: frozenRate,
          })
        : `1 $ = ${frozenRate.toLocaleString("fr-FR")} CDF`
      : null;
  const paidUsd = paymentAmountUsd(payment);
  const paidCdf =
    isHospitalityBranch && payment.amountForeign != null && payment.amountForeign > 0
      ? payment.amountCdf
      : payment.amountCdf;

  const backHref =
    branch.type === "BOUTIQUE"
      ? boutiqueRoutes.pos(organizationId, branchId)
      : branchCaissePath(organizationId, branchId);

  function formatLineMoney(line: ReceiptLine) {
    if (isHospitalityBranch && !isShopReceipt) {
      return formatUsdLineTotal(line.quantity, line.unitPrice, moneyRate);
    }
    return `${line.amount.toFixed(2)}${isHospitalityBranch || isShopReceipt ? " $" : ""}`;
  }

  function formatUnitMoney(unit: number) {
    if (isHospitalityBranch && !isShopReceipt && cdfPrimary && moneyRate) {
      return `${Math.round(unit * Math.round(moneyRate.rate)).toLocaleString("fr-FR")} CDF`;
    }
    if (isHospitalityBranch || isShopReceipt) {
      return `${unit.toFixed(2)} $`;
    }
    return unit.toFixed(2);
  }

  function formatSectionTotal(sectionLines: ReceiptLine[]) {
    if (isHospitalityBranch && !isShopReceipt) {
      return formatUsdLinesTotal(
        sectionLines.map((l) => ({
          quantity: l.quantity,
          unitPriceUsd: l.unitPrice,
        })),
        moneyRate,
      );
    }
    const t = sectionLines.reduce((s, l) => s + l.amount, 0);
    return `${t.toFixed(2)}${isHospitalityBranch || isShopReceipt ? " $" : ""}`;
  }

  function LineRow(props: { line: ReceiptLine }) {
    const { line } = props;
    return (
      <li className="grid grid-cols-[minmax(0,1fr)_2rem_3.25rem_3.75rem] items-start gap-1.5 text-sm">
        <div className="min-w-0">
          <p className="break-words font-medium leading-snug">{line.label}</p>
          {line.wasPromo ? (
            <p className="text-[10px] font-medium text-amber-700 dark:text-amber-300">
              Promo
            </p>
          ) : null}
        </div>
        <p className="pt-0.5 text-center tabular-nums text-muted-foreground">
          {line.quantity}
        </p>
        <p className="pt-0.5 text-right tabular-nums text-muted-foreground">
          {formatUnitMoney(line.unitPrice)}
        </p>
        <p className="pt-0.5 text-right font-semibold tabular-nums">
          {formatLineMoney(line)}
        </p>
      </li>
    );
  }

  function LinesHeader() {
    return (
      <div className="mb-1.5 grid grid-cols-[minmax(0,1fr)_2rem_3.25rem_3.75rem] gap-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span>Article</span>
        <span className="text-center">Qté</span>
        <span className="text-right">Prix</span>
        <span className="text-right">Total</span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="mb-4 flex gap-2 print:hidden">
        <PrintButton />
        <Button variant="outline" render={<Link href={backHref} />}>
          {branch.type === "BOUTIQUE" ? "Retour POS" : "Retour caisse"}
        </Button>
      </div>

      <article className="rounded-2xl border border-border bg-card p-6 shadow-sm print:border-0 print:shadow-none">
        <header className="border-b border-border pb-4 text-center">
          <p className="text-xs tracking-widest text-muted-foreground uppercase">
            Coccinelle
          </p>
          <h1 className="text-xl font-bold">{branch.name}</h1>
          <p className="text-sm text-muted-foreground">
            {isFolioReceipt
              ? "Reçu — note de chambre"
              : isShopReceipt
                ? payment.shopSale?.ticketNumber
                  ? `Reçu vente · ${payment.shopSale.ticketNumber}`
                  : "Reçu de vente"
                : "Reçu de paiement"}
          </p>
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
              <dt className="text-muted-foreground">
                {isShopReceipt ? "Client" : "Réf."}
              </dt>
              <dd className="text-right">{guestLabel}</dd>
            </div>
          ) : null}
          {serverName ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Serveur</dt>
              <dd className="text-right">{serverName}</dd>
            </div>
          ) : null}
        </dl>

        {folioSections.length > 0 ? (
          <div className="mt-5 space-y-4 border-t border-border pt-4">
            {folioSections.map((section) => (
              <section key={section.kind}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {section.label}
                  </h2>
                  <span className="text-xs font-medium tabular-nums">
                    {formatSectionTotal(section.lines)}
                  </span>
                </div>
                <LinesHeader />
                <ul className="space-y-2">
                  {section.lines.map((line) => (
                    <LineRow key={line.key} line={line} />
                  ))}
                </ul>
              </section>
            ))}
            <div className="flex justify-between gap-4 border-t border-dashed border-border pt-3 text-sm">
              <span className="text-muted-foreground">Total note</span>
              <span className="font-medium tabular-nums">
                {linesTotalLabel}
              </span>
            </div>
          </div>
        ) : lines.length > 0 ? (
          <section className="mt-5 border-t border-border pt-4">
            <h2 className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Articles
            </h2>
            <LinesHeader />
            <ul className="space-y-2">
              {lines.map((line) => (
                <LineRow key={line.key} line={line} />
              ))}
            </ul>
            <div className="mt-3 flex justify-between gap-4 border-t border-dashed border-border pt-3 text-sm">
              <span className="text-muted-foreground">Sous-total articles</span>
              <span className="font-medium tabular-nums">
                {linesTotalLabel}
              </span>
            </div>
          </section>
        ) : (
          <section className="mt-5 border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Aucune ligne article associée à ce paiement.
            </p>
          </section>
        )}

        <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
          {isHospitalityBranch || isShopReceipt ? (
            <>
              <div className="flex justify-between gap-4 text-base">
                <dt className="font-semibold">Montant payé</dt>
                <dd className="font-bold tabular-nums">
                  {(isShopReceipt ? payment.amountCdf : paidUsd).toFixed(2)} $
                </dd>
              </div>
              {payment.exchangeRateUsed != null ? (
                <>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Équiv. CDF</dt>
                    <dd className="tabular-nums">
                      {(isShopReceipt
                        ? payment.amountCdf * payment.exchangeRateUsed
                        : paidCdf
                      ).toLocaleString("fr-FR", {
                        maximumFractionDigits: 0,
                      })}{" "}
                      CDF
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">Taux figé</dt>
                    <dd>
                      {rateLabelForReceipt ??
                        `1 $ = ${Math.round(payment.exchangeRateUsed!).toLocaleString("fr-FR")} CDF`}
                    </dd>
                  </div>
                </>
              ) : null}
            </>
          ) : (
            <>
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
                      {rateLabelForReceipt ??
                        `1 $ = ${Math.round(payment.exchangeRateUsed!).toLocaleString("fr-FR")} CDF`}
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
            </>
          )}
          {payment.note && !isShopReceipt ? (
            <div className="pt-2 text-muted-foreground">{payment.note}</div>
          ) : null}
        </dl>

        {isPharmacy ? (
          <p className="mt-5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-center text-[11px] leading-relaxed text-muted-foreground print:border-muted-foreground/30">
            Les produits vendus ne sont ni remboursables, ni échangeables après
            avoir quitté le site.
          </p>
        ) : null}

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Merci · Conservez ce reçu
        </p>
      </article>
    </div>
  );
}
