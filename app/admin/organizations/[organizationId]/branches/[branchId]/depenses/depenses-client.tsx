"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formatBothAmounts,
  formatPrimaryAmount,
  primaryAmountToUsd,
  primaryCurrencyLabel,
  primaryPriceInputStep,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";
import { branchCaissePath, branchDashboardPath } from "@/lib/branch/paths";
import { createExpenseAction } from "@/lib/purchases/actions";
import { PosPayMethodPicker } from "@/components/pos/pos-terminal";
import {
  defaultExpenseCategory,
  defaultExpenseLabel,
  expenseBeneficiaryRole,
  expenseDocumentTitle,
  expenseKindLabel,
  isOwnerAdvanceKind,
  normalizeExpenseKind,
  type ExpenseKind,
} from "@/lib/expenses/kinds";
import { cn } from "@/lib/utils";

type Expense = {
  id: string;
  number: string;
  kind: string;
  label: string;
  category: string;
  beneficiary: string | null;
  amountUsd: number;
  note: string | null;
  createdAt: string | Date;
  payment: { id: string; receiptNumber: string } | null;
};

const KIND_OPTIONS: { value: ExpenseKind; hint: string }[] = [
  {
    value: "DEPENSE",
    hint: "Achat, facture, frais courants — sortie de caisse",
  },
  {
    value: "DEPOT_BANQUE",
    hint: "Versement du fond de caisse à la banque",
  },
  {
    value: "REMISE_PROPRIETAIRE",
    hint: "Remise d’espèces au propriétaire",
  },
  {
    value: "PRET_PROPRIETAIRE",
    hint: "Le propriétaire avance des fonds (caisse vide ou insuffisante)",
  },
];

function money(n: number, rate: NormalizedUsdCdfRate | null) {
  return formatPrimaryAmount(n, rate);
}

function buildExpenseHtml(
  e: Expense,
  branchName: string,
  rate: NormalizedUsdCdfRate | null,
) {
  const kind = normalizeExpenseKind(e.kind);
  const title = expenseDocumentTitle(kind);
  const amount = money(e.amountUsd, rate);
  const both = formatBothAmounts(e.amountUsd, rate);
  const date = new Date(e.createdAt).toLocaleString("fr-FR");
  const beneficiaryRole = expenseBeneficiaryRole(kind);
  const receipt = e.payment?.receiptNumber ?? "—";
  const isAdvance = isOwnerAdvanceKind(kind);
  const amountLine = isAdvance
    ? `Montant entré en caisse : ${amount}`
    : `Montant sorti de caisse : ${amount}`;
  const legal = isAdvance
    ? "Document comptable établissant l’avance / prêt du propriétaire à l’entreprise (branche). Alimente la caisse. À conserver après signature."
    : "Document comptable établissant le décaissement de la caisse. À conserver après signature.";
  const footer = isAdvance
    ? `Coccinelle · ${e.number} · Entrée de fonds (prêt propriétaire) — n’est pas une charge d’exploitation.`
    : `Coccinelle · ${e.number} · Sortie de fonds considérée comme dépense (impact solde caisse / rapport financier).`;

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${e.number}</title>
    <style>
      @page { margin: 16mm; }
      body{font-family:Georgia,serif;padding:28px;color:#111;margin:0;line-height:1.45}
      h1{margin:0 0 6px;font-size:20px;font-weight:700;letter-spacing:.01em}
      .muted{color:#555;font-size:13px}
      .box{border:1px solid #222;padding:14px 16px;margin-top:18px}
      .row{display:flex;justify-content:space-between;gap:16px;margin:6px 0}
      .label{color:#555;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
      .value{font-size:15px;font-weight:600}
      .amount{font-size:22px;font-weight:700;margin-top:10px}
      .sigs{display:grid;grid-template-columns:1fr 1fr;gap:28px;margin-top:48px}
      .sig{border-top:1px solid #333;padding-top:8px;min-height:72px}
      .sig b{display:block;font-size:13px}
      .sig span{font-size:12px;color:#555}
      .footer{margin-top:28px;font-size:11px;color:#666}
    </style></head><body>
    <h1>${title}</h1>
    <p class="muted">${branchName} · Réf. ${e.number} · Reçu caisse ${receipt}</p>
    <p class="muted">Date : ${date}</p>
    <div class="box">
      <div class="row"><div><div class="label">Nature</div><div class="value">${expenseKindLabel(kind)}</div></div>
      <div><div class="label">Catégorie</div><div class="value">${e.category}</div></div></div>
      <div class="row"><div><div class="label">Libellé</div><div class="value">${e.label}</div></div></div>
      ${
        e.beneficiary
          ? `<div class="row"><div><div class="label">${beneficiaryRole}</div><div class="value">${e.beneficiary}</div></div></div>`
          : ""
      }
      ${e.note ? `<div class="row"><div><div class="label">Note</div><div class="value" style="font-weight:400">${e.note}</div></div></div>` : ""}
      <p class="amount">${amountLine}</p>
      <p class="muted">${both}</p>
      <p class="muted" style="margin-top:12px">${legal}</p>
    </div>
    <div class="sigs">
      <div class="sig"><b>Caissier / Gérant</b><span>Nom &amp; signature</span></div>
      <div class="sig"><b>${beneficiaryRole}</b><span>${e.beneficiary ? `${e.beneficiary} — ` : ""}Nom &amp; signature</span></div>
    </div>
    <p class="footer">${footer}</p>
    </body></html>`;
}

function printHtmlDocument(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    toast.error("Impossible de préparer l’impression.");
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();
  const win = iframe.contentWindow;
  window.setTimeout(() => {
    try {
      win?.focus();
      win?.print();
    } catch {
      toast.error("Impression impossible.");
    } finally {
      window.setTimeout(() => iframe.remove(), 1000);
    }
  }, 200);
}

export function DepensesClient(props: {
  organizationId: string;
  branchId: string;
  branchName: string;
  expenses: Expense[];
  rate: NormalizedUsdCdfRate | null;
  cashDrawer: {
    sessionId: string;
    openedAt: string | Date;
    openingFloatUsd: number;
    movementsUsd: number;
    balanceUsd: number;
    movementsCount: number;
  } | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Expense | null>(null);
  const [kind, setKind] = useState<ExpenseKind>("DEPENSE");
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState(defaultExpenseCategory("DEPENSE"));
  const [beneficiary, setBeneficiary] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [method, setMethod] = useState<"CASH" | "MOBILE_MONEY" | "CARTE">(
    "CASH",
  );

  const hasOpenCashSession = Boolean(props.cashDrawer);
  const currency = primaryCurrencyLabel(props.rate);
  const step = primaryPriceInputStep(props.rate);
  const totalOutflows = useMemo(
    () =>
      props.expenses
        .filter((e) => !isOwnerAdvanceKind(normalizeExpenseKind(e.kind)))
        .reduce((s, e) => s + e.amountUsd, 0),
    [props.expenses],
  );
  const totalAdvances = useMemo(
    () =>
      props.expenses
        .filter((e) => isOwnerAdvanceKind(normalizeExpenseKind(e.kind)))
        .reduce((s, e) => s + e.amountUsd, 0),
    [props.expenses],
  );

  const draftAmountUsd = primaryAmountToUsd(Number(amount) || 0, props.rate);
  const isAdvanceDraft = isOwnerAdvanceKind(kind);
  const balanceAfter =
    props.cashDrawer && draftAmountUsd > 0
      ? props.cashDrawer.balanceUsd +
        (isAdvanceDraft ? draftAmountUsd : -draftAmountUsd)
      : (props.cashDrawer?.balanceUsd ?? null);
  const cashLow =
    props.cashDrawer != null && props.cashDrawer.balanceUsd < 0.01;

  function onKindChange(next: ExpenseKind) {
    setKind(next);
    setCategory(defaultExpenseCategory(next));
    const def = defaultExpenseLabel(next);
    if (def) setLabel(def);
    else if (
      label === defaultExpenseLabel("DEPOT_BANQUE") ||
      label === defaultExpenseLabel("REMISE_PROPRIETAIRE") ||
      label === defaultExpenseLabel("PRET_PROPRIETAIRE")
    ) {
      setLabel("");
    }
  }

  function submit() {
    start(async () => {
      try {
        const expense = await createExpenseAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          kind,
          label,
          category,
          beneficiary: beneficiary || null,
          amountUsd: primaryAmountToUsd(Number(amount) || 0, props.rate),
          note: note || null,
          method,
        });
        toast.success(
          isOwnerAdvanceKind(kind)
            ? "Prêt enregistré · caisse alimentée"
            : "Sortie de caisse enregistrée",
        );
        setOpen(false);
        setLabel("");
        setKind("DEPENSE");
        setCategory(defaultExpenseCategory("DEPENSE"));
        setBeneficiary("");
        setAmount("");
        setNote("");
        setMethod("CASH");
        setPreview({
          ...expense,
          payment: null,
        } as Expense);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const needsBeneficiary =
    kind === "DEPOT_BANQUE" ||
    kind === "REMISE_PROPRIETAIRE" ||
    kind === "PRET_PROPRIETAIRE";

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href={branchDashboardPath(props.organizationId, props.branchId)}
            className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" /> Dashboard
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Dépenses</h1>
          <p className="text-sm text-muted-foreground">
            {props.branchName} · sorties, dépôt banque, remise ou prêt
            propriétaire (alimente la caisse) · document à signer
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!hasOpenCashSession ? (
            <Button
              variant="outline"
              render={
                <Link
                  href={branchCaissePath(
                    props.organizationId,
                    props.branchId,
                  )}
                />
              }
            >
              Ouvrir la caisse
            </Button>
          ) : null}
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 size-4" /> Nouvelle opération
          </Button>
        </div>
      </div>

      {props.cashDrawer ? (
        <div className="grid gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-4 py-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Solde caisse
            </p>
            <p className="text-lg font-semibold tabular-nums">
              {formatPrimaryAmount(props.cashDrawer.balanceUsd, props.rate)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {formatBothAmounts(props.cashDrawer.balanceUsd, props.rate)}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Fond d’ouverture
            </p>
            <p className="text-sm font-medium tabular-nums">
              {formatPrimaryAmount(
                props.cashDrawer.openingFloatUsd,
                props.rate,
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Session ouverte ·{" "}
              {new Date(props.cashDrawer.openedAt).toLocaleString("fr-FR")}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
              Mouvements session
            </p>
            <p className="text-sm font-medium tabular-nums">
              {formatPrimaryAmount(props.cashDrawer.movementsUsd, props.rate)}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {props.cashDrawer.movementsCount} opération
              {props.cashDrawer.movementsCount === 1 ? "" : "s"}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-950 dark:text-amber-100">
          Aucune session de caisse ouverte — ouvrez la caisse avant une
          opération de fonds.
        </div>
      )}

      {cashLow && hasOpenCashSession ? (
        <div className="rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 text-sm">
          Caisse vide ou quasi vide — le propriétaire peut enregistrer un{" "}
          <button
            type="button"
            className="font-semibold text-sky-800 underline underline-offset-2 dark:text-sky-200"
            onClick={() => {
              onKindChange("PRET_PROPRIETAIRE");
              setOpen(true);
            }}
          >
            prêt / avance
          </button>{" "}
          pour alimenter la branche, puis faire les dépenses.
        </div>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 px-4 py-3 text-sm">
          Total sorties :{" "}
          <span className="font-semibold">
            {formatPrimaryAmount(totalOutflows, props.rate)}
          </span>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
          Total prêts propriétaire :{" "}
          <span className="font-semibold">
            {formatPrimaryAmount(totalAdvances, props.rate)}
          </span>
        </div>
      </div>

      <ul className="space-y-2">
        {props.expenses.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucune opération enregistrée.
          </li>
        ) : (
          props.expenses.map((e) => {
            const k = normalizeExpenseKind(e.kind);
            const advance = isOwnerAdvanceKind(k);
            return (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{e.label}</p>
                    <Badge variant="secondary" className="text-[10px]">
                      {expenseKindLabel(k)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {e.number}
                    {e.beneficiary ? ` · ${e.beneficiary}` : ""}
                    {` · ${e.category}`}
                    {e.note ? ` · ${e.note}` : ""}
                    {e.payment ? ` · ${e.payment.receiptNumber}` : ""}
                    {" · "}
                    {new Date(e.createdAt).toLocaleString("fr-FR")}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "font-semibold",
                      advance
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-rose-700 dark:text-rose-300",
                    )}
                  >
                    {advance ? "+" : "−"}
                    {formatPrimaryAmount(e.amountUsd, props.rate)}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setPreview(e)}
                  >
                    <Printer className="mr-1 size-3.5" /> Document
                  </Button>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[94svh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Nouvelle opération de caisse</DialogTitle>
            <DialogDescription>
              Sortie (dépense, banque, remise) ou entrée via prêt propriétaire
              quand la caisse est vide. Document comptable pour signature.
            </DialogDescription>
          </DialogHeader>

          {props.cashDrawer ? (
            <div className="grid gap-3 rounded-xl border border-border bg-muted/40 px-4 py-3 sm:grid-cols-4">
              <div className="sm:col-span-2">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Solde actuel
                </p>
                <p className="text-xl font-semibold tabular-nums">
                  {formatPrimaryAmount(
                    props.cashDrawer.balanceUsd,
                    props.rate,
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {formatBothAmounts(props.cashDrawer.balanceUsd, props.rate)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Fond
                </p>
                <p className="text-sm font-medium tabular-nums">
                  {formatPrimaryAmount(
                    props.cashDrawer.openingFloatUsd,
                    props.rate,
                  )}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  Après cette opération
                </p>
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    balanceAfter != null && balanceAfter < 0
                      ? "text-rose-700 dark:text-rose-300"
                      : "",
                  )}
                >
                  {balanceAfter != null
                    ? formatPrimaryAmount(balanceAfter, props.rate)
                    : "—"}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
              Ouvrez d’abord une session de caisse.
            </div>
          )}

          {cashLow ? (
            <p className="rounded-lg border border-sky-500/25 bg-sky-500/5 px-3 py-2 text-xs text-muted-foreground">
              Astuce : choisissez « Prêt propriétaire » pour injecter des fonds,
              puis enregistrez vos dépenses.
            </p>
          ) : null}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label>Type d’opération</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {KIND_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onKindChange(opt.value)}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition",
                      kind === opt.value
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-border hover:bg-muted/50",
                    )}
                  >
                    <p className="text-sm font-medium">
                      {expenseKindLabel(opt.value)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {opt.hint}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Libellé</Label>
                <Input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={
                    kind === "DEPENSE"
                      ? "Ex. électricité, transport…"
                      : defaultExpenseLabel(kind)
                  }
                  required
                />
              </div>
              {needsBeneficiary ? (
                <div className="grid gap-1.5">
                  <Label>
                    {kind === "DEPOT_BANQUE"
                      ? "Banque"
                      : "Nom du propriétaire"}
                  </Label>
                  <Input
                    value={beneficiary}
                    onChange={(e) => setBeneficiary(e.target.value)}
                    placeholder={
                      kind === "DEPOT_BANQUE"
                        ? "Ex. Rawbank, Equity…"
                        : "Nom complet"
                    }
                    required
                  />
                </div>
              ) : null}
              <div
                className={cn(
                  "grid gap-1.5",
                  !needsBeneficiary && "sm:col-span-1",
                )}
              >
                <Label>Catégorie</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder={defaultExpenseCategory(kind)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Montant ({currency})</Label>
                <Input
                  type="number"
                  min={0.01}
                  step={step}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                {draftAmountUsd > 0 ? (
                  <p className="text-[11px] text-muted-foreground">
                    {formatBothAmounts(draftAmountUsd, props.rate)}
                    {!isAdvanceDraft &&
                    props.cashDrawer &&
                    draftAmountUsd > props.cashDrawer.balanceUsd + 0.01
                      ? " · dépasse le solde — enregistrez d’abord un prêt propriétaire"
                      : isAdvanceDraft
                        ? " · entrée en caisse"
                        : ""}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label>Note</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optionnel — précision pour le document"
                />
              </div>
            </div>

            <PosPayMethodPicker value={method} onChange={setMethod} />
            <Button
              className="w-full"
              disabled={
                pending ||
                !(Number(amount) > 0) ||
                !hasOpenCashSession ||
                (kind === "DEPENSE" && !label.trim()) ||
                (needsBeneficiary && !beneficiary.trim())
              }
              onClick={submit}
            >
              {isAdvanceDraft
                ? "Enregistrer le prêt · produire le document"
                : "Enregistrer · produire le document"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!preview}
        onOpenChange={(o) => {
          if (!o) setPreview(null);
        }}
      >
        <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Document comptable</DialogTitle>
            <DialogDescription>
              À imprimer pour signature (caissier et{" "}
              {preview
                ? expenseBeneficiaryRole(
                    normalizeExpenseKind(preview.kind),
                  ).toLowerCase()
                : "bénéficiaire"}
              ).
            </DialogDescription>
          </DialogHeader>
          {preview ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-background p-5 text-foreground shadow-sm">
                <h2 className="text-base font-semibold">
                  {expenseDocumentTitle(normalizeExpenseKind(preview.kind))}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {props.branchName} · {preview.number}
                  {preview.payment
                    ? ` · ${preview.payment.receiptNumber}`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(preview.createdAt).toLocaleString("fr-FR")}
                </p>
                <dl className="mt-4 grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Nature</dt>
                    <dd className="font-medium">
                      {expenseKindLabel(normalizeExpenseKind(preview.kind))}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Libellé</dt>
                    <dd className="font-medium text-right">{preview.label}</dd>
                  </div>
                  {preview.beneficiary ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">
                        {expenseBeneficiaryRole(
                          normalizeExpenseKind(preview.kind),
                        )}
                      </dt>
                      <dd className="font-medium text-right">
                        {preview.beneficiary}
                      </dd>
                    </div>
                  ) : null}
                  {preview.note ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Note</dt>
                      <dd className="text-right">{preview.note}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3 border-t border-border pt-2">
                    <dt className="text-muted-foreground">
                      {isOwnerAdvanceKind(normalizeExpenseKind(preview.kind))
                        ? "Montant entré en caisse"
                        : "Montant décaissé"}
                    </dt>
                    <dd
                      className={cn(
                        "text-lg font-bold",
                        isOwnerAdvanceKind(normalizeExpenseKind(preview.kind))
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-rose-700 dark:text-rose-300",
                      )}
                    >
                      {isOwnerAdvanceKind(normalizeExpenseKind(preview.kind))
                        ? "+"
                        : "−"}
                      {money(preview.amountUsd, props.rate)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-8 grid grid-cols-2 gap-6 text-xs text-muted-foreground">
                  <div className="border-t border-foreground/40 pt-2">
                    <p className="font-medium text-foreground">
                      Caissier / Gérant
                    </p>
                    <p>Nom & signature</p>
                  </div>
                  <div className="border-t border-foreground/40 pt-2">
                    <p className="font-medium text-foreground">
                      {expenseBeneficiaryRole(
                        normalizeExpenseKind(preview.kind),
                      )}
                    </p>
                    <p>Nom & signature</p>
                  </div>
                </div>
              </div>
              <Button
                className="w-full"
                onClick={() =>
                  printHtmlDocument(
                    buildExpenseHtml(preview, props.branchName, props.rate),
                  )
                }
              >
                <Printer className="mr-1.5 size-4" /> Imprimer
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
