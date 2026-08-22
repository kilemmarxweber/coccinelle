"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  boutiqueOutlineBtn,
  boutiquePrimaryBtn,
} from "@/components/boutique/boutique-shell";
import { usineRoutes } from "@/lib/branch/paths";

const PAY_KIND: Record<string, string> = {
  ACOMPTE: "Acompte",
  COMPLEMENT: "Complément",
  SOLDE: "Solde",
};

type CreditDoc = {
  id: string;
  number: string;
  status: string;
  dueAt: Date | string;
  createdAt?: Date | string;
  totalUsd: number;
  paidUsd?: number;
  fxUsdToCdf: number | null;
  marketerDisplayName: string;
  signedAt: Date | string | null;
  customer: {
    name: string;
    phone: string | null;
    companyName: string | null;
  };
  lines: {
    nameSnapshot: string;
    qty: number;
    unitPriceUsd: number;
    lineTotalUsd: number;
  }[];
  payments?: {
    id: string;
    installmentKind: string | null;
    amountForeign: number | null;
    paidAt: Date | string;
  }[];
};

export function UsineCreditDocument(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  credit: CreditDoc;
}) {
  const { credit } = props;
  const paid = credit.paidUsd ?? 0;
  const remaining = Math.max(0, credit.totalUsd - paid);
  const cdf =
    credit.fxUsdToCdf != null
      ? Math.round(credit.totalUsd * credit.fxUsdToCdf)
      : null;
  const due = new Date(credit.dueAt);
  const issued = credit.createdAt ? new Date(credit.createdAt) : new Date();
  const backHref = usineRoutes.credits(props.organizationId, props.branchId);

  return (
    <div className="min-h-svh bg-background px-3 py-6 sm:px-4 sm:py-8 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-2xl print:max-w-none">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-1 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            render={<Link href={backHref} />}
          >
            <ArrowLeft className="size-4" />
            Crédits
          </Button>
          <Button
            type="button"
            className={boutiquePrimaryBtn()}
            onClick={() => window.print()}
          >
            <Printer className="size-4" />
            Imprimer / PDF
          </Button>
        </div>

        <article className="overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-sm print:rounded-none print:border-0 print:shadow-none">
          <div className="h-1.5 bg-primary" />
          <div className="px-5 py-7 sm:px-10 sm:py-8">
            <header className="mb-8 flex items-start justify-between gap-4 border-b border-border pb-6">
              <div>
                <p className="text-[11px] font-semibold tracking-[0.2em] text-primary uppercase">
                  Bon de crédit
                </p>
                <p className="mt-1 font-serif text-2xl font-semibold text-foreground">
                  {props.branchName}
                </p>
                <p className="text-sm text-muted-foreground">{credit.number}</p>
              </div>
              <p className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold tracking-wide text-primary-foreground">
                {credit.status === "SETTLED"
                  ? "Soldé"
                  : credit.status === "PARTIAL"
                    ? "Partiel"
                    : "À payer"}
              </p>
            </header>

            <div className="mb-6 grid gap-4 text-sm sm:grid-cols-2">
              <p>
                <span className="text-muted-foreground">Client</span>
                <br />
                <strong className="text-foreground">{credit.customer.name}</strong>
                {credit.customer.companyName ? (
                  <span className="block text-muted-foreground">
                    {credit.customer.companyName}
                  </span>
                ) : null}
                {credit.customer.phone ? (
                  <span className="block tabular-nums">
                    {credit.customer.phone}
                  </span>
                ) : null}
              </p>
              <p>
                <span className="text-muted-foreground">Marketeur</span>
                <br />
                <strong className="text-foreground">
                  {credit.marketerDisplayName}
                </strong>
              </p>
              <p>
                <span className="text-muted-foreground">Date</span>
                <br />
                <strong>{issued.toLocaleDateString("fr-CD")}</strong>
              </p>
              <p>
                <span className="text-muted-foreground">Échéance</span>
                <br />
                <strong>{due.toLocaleDateString("fr-CD")}</strong>
              </p>
            </div>

            {credit.fxUsdToCdf ? (
              <p className="mb-5 text-xs text-muted-foreground">
                Taux : 1 USD = {credit.fxUsdToCdf.toLocaleString("fr-CD")} CDF
              </p>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] tracking-wide text-primary uppercase">
                    <th className="py-2 pr-2 font-semibold">Désignation</th>
                    <th className="py-2 pr-2 text-right font-semibold">Qté</th>
                    <th className="py-2 pr-2 text-right font-semibold">P.U.</th>
                    <th className="py-2 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {credit.lines.map((l, i) => (
                    <tr
                      key={`${l.nameSnapshot}-${i}`}
                      className="border-b border-border"
                    >
                      <td className="py-2.5 pr-2">{l.nameSnapshot}</td>
                      <td className="py-2.5 pr-2 text-right tabular-nums">
                        {l.qty}
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums">
                        {l.unitPriceUsd.toFixed(2)}
                      </td>
                      <td className="py-2.5 text-right font-medium tabular-nums">
                        {l.lineTotalUsd.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 space-y-1.5 text-sm tabular-nums">
              <p className="flex justify-between border-t border-border pt-4 font-serif text-xl font-semibold text-foreground">
                <span>Total</span>
                <span>{credit.totalUsd.toFixed(2)} USD</span>
              </p>
              {cdf != null ? (
                <p className="flex justify-between text-primary">
                  <span />
                  <span>≈ {cdf.toLocaleString("fr-CD")} CDF</span>
                </p>
              ) : null}
              {paid > 0 ? (
                <>
                  <p className="flex justify-between text-emerald-800">
                    <span>Déjà payé</span>
                    <span>{paid.toFixed(2)} USD</span>
                  </p>
                  <p className="flex justify-between font-semibold">
                    <span>Restant</span>
                    <span>{remaining.toFixed(2)} USD</span>
                  </p>
                </>
              ) : null}
            </div>

            {credit.payments?.length ? (
              <div className="mt-6 rounded-2xl bg-muted/30 px-4 py-3 text-sm">
                <p className="mb-2 font-semibold text-foreground">Paiements</p>
                <ul className="space-y-1 text-muted-foreground">
                  {credit.payments.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3">
                      <span>
                        {PAY_KIND[p.installmentKind ?? ""] ??
                          p.installmentKind ??
                          "Paiement"}{" "}
                        · {new Date(p.paidAt).toLocaleDateString("fr-CD")}
                      </span>
                      <span className="tabular-nums">
                        {(p.amountForeign ?? 0).toFixed(2)} $
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
              Le client reconnaît avoir reçu les quantités ci-dessus et s’engage
              à payer au plus tard le {due.toLocaleDateString("fr-CD")}.
            </p>

            <div className="mt-10 grid grid-cols-2 gap-8 text-sm">
              <div>
                <p className="text-muted-foreground">Signature client</p>
                {credit.signedAt ? (
                  <p className="mt-1 text-[11px] text-emerald-800">
                    Signé sur papier
                  </p>
                ) : null}
                <span className="mt-12 block border-t border-border" />
              </div>
              <div>
                <p className="text-muted-foreground">Signature marketeur</p>
                <span className="mt-12 block border-t border-border" />
              </div>
            </div>
          </div>
        </article>

        <div className="mt-4 flex justify-center print:hidden">
          <Button
            variant="outline"
            className={boutiqueOutlineBtn()}
            render={<Link href={backHref} />}
          >
            Retour aux crédits
          </Button>
        </div>
      </div>
    </div>
  );
}
