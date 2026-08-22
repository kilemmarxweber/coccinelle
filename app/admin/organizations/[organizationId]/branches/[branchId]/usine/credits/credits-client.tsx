"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BoutiquePanel,
  BoutiqueStatus,
  boutiqueOutlineBtn,
  boutiquePrimaryBtn,
} from "@/components/boutique/boutique-shell";
import { usineRoutes } from "@/lib/branch/paths";
import {
  extendFactoryCreditAction,
  payFactoryCreditAction,
} from "@/lib/factory/actions";

type Credit = {
  id: string;
  number: string;
  status: string;
  totalUsd: number;
  paidUsd: number;
  dueAt: Date;
  marketerDisplayName: string;
  customer: { name: string; phone: string | null; companyName: string | null };
  lines: { nameSnapshot: string; qty: number }[];
};

const STATUS: Record<
  string,
  { label: string; tone: "ok" | "warn" | "danger" | "neutral" | "info" }
> = {
  OPEN: { label: "Ouvert", tone: "info" },
  PARTIAL: { label: "Partiel", tone: "warn" },
  SETTLED: { label: "Soldé", tone: "ok" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
};

export function UsineCreditsClient(props: {
  organizationId: string;
  branchId: string;
  credits: Credit[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [payId, setPayId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [extendId, setExtendId] = useState<string | null>(null);
  const [newDue, setNewDue] = useState("");
  const [reason, setReason] = useState("");

  if (!props.credits.length) {
    return (
      <EmptyState
        icon={FileText}
        title="Aucun crédit"
        description="Créez une vente à crédit depuis le bouton Nouvelle vente."
      />
    );
  }

  function remainingOf(c: Credit) {
    return Math.max(0, c.totalUsd - c.paidUsd);
  }

  function actions(c: Credit) {
    const remaining = remainingOf(c);
    return (
      <>
        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className={boutiqueOutlineBtn("h-8")}
            render={
              <Link
                href={`${usineRoutes.credit(props.organizationId, props.branchId, c.id)}/document`}
              />
            }
          >
            Document
          </Button>
          {c.status !== "SETTLED" && c.status !== "CANCELLED" ? (
            <>
              <Button
                size="sm"
                className={boutiquePrimaryBtn("h-8")}
                onClick={() => {
                  setPayId(payId === c.id ? null : c.id);
                  setExtendId(null);
                }}
              >
                Encaisser
              </Button>
              <Button
                size="sm"
                variant="outline"
                className={boutiqueOutlineBtn("h-8")}
                onClick={() => {
                  setExtendId(extendId === c.id ? null : c.id);
                  setPayId(null);
                }}
              >
                Prolonger
              </Button>
            </>
          ) : null}
        </div>
        {payId === c.id ? (
          <form
            className="mt-3 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                try {
                  const res = await payFactoryCreditAction({
                    organizationId: props.organizationId,
                    branchId: props.branchId,
                    creditId: c.id,
                    amountUsd: Number(amount),
                  });
                  toast.success(
                    res.status === "SETTLED"
                      ? "Crédit soldé"
                      : `${res.kind} enregistré`,
                  );
                  setPayId(null);
                  setAmount("");
                  router.refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Erreur");
                }
              });
            }}
          >
            <Input
              type="number"
              step="0.01"
              max={remaining}
              placeholder={`Max ${remaining.toFixed(2)} $`}
              className="h-10 rounded-xl"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Button
              type="submit"
              disabled={pending}
              className={boutiquePrimaryBtn("h-10 shrink-0")}
            >
              Payer
            </Button>
          </form>
        ) : null}
        {extendId === c.id ? (
          <form
            className="mt-3 grid gap-2 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                try {
                  await extendFactoryCreditAction({
                    organizationId: props.organizationId,
                    branchId: props.branchId,
                    creditId: c.id,
                    newDueAt: newDue,
                    reason,
                  });
                  toast.success("Échéance prolongée");
                  setExtendId(null);
                  router.refresh();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Erreur");
                }
              });
            }}
          >
            <Input
              type="date"
              className="h-10 rounded-xl"
              value={newDue}
              onChange={(e) => setNewDue(e.target.value)}
              required
            />
            <Input
              placeholder="Motif"
              className="h-10 rounded-xl"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
            <Button
              type="submit"
              disabled={pending}
              className={boutiquePrimaryBtn("h-10")}
            >
              Enregistrer
            </Button>
          </form>
        ) : null}
      </>
    );
  }

  return (
    <>
      <ul className="space-y-3 lg:hidden">
        {props.credits.map((c) => {
          const remaining = remainingOf(c);
          const st = STATUS[c.status] ?? {
            label: c.status,
            tone: "neutral" as const,
          };
          return (
            <li
              key={c.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">
                    {c.number} · {c.customer.name}
                  </p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    {c.totalUsd.toFixed(2)} $ · restant {remaining.toFixed(2)} $
                    · {new Date(c.dueAt).toLocaleDateString("fr-CD")}
                  </p>
                  <p className="mt-1 truncate text-[11px] text-muted-foreground">
                    {c.lines.map((l) => `${l.qty}× ${l.nameSnapshot}`).join(", ")}
                  </p>
                </div>
                <BoutiqueStatus tone={st.tone}>{st.label}</BoutiqueStatus>
              </div>
              <div className="mt-3">{actions(c)}</div>
            </li>
          );
        })}
      </ul>

      <BoutiquePanel
        className="hidden overflow-hidden lg:block"
        title="Suivi des crédits"
        bodyClassName="p-0"
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Crédit</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>Statut</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Restant</TableHead>
              <TableHead>Échéance</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {props.credits.map((c) => {
              const remaining = remainingOf(c);
              const st = STATUS[c.status] ?? {
                label: c.status,
                tone: "neutral" as const,
              };
              return (
                <TableRow key={c.id} className="align-top">
                  <TableCell className="whitespace-normal">
                    <p className="font-semibold">{c.number}</p>
                    <p className="max-w-[220px] truncate text-[11px] text-muted-foreground">
                      {c.lines
                        .map((l) => `${l.qty}× ${l.nameSnapshot}`)
                        .join(", ")}
                    </p>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    <p className="font-medium">{c.customer.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {[c.customer.companyName, c.customer.phone]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </TableCell>
                  <TableCell>
                    <BoutiqueStatus tone={st.tone}>{st.label}</BoutiqueStatus>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.totalUsd.toFixed(2)} $
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {remaining.toFixed(2)} $
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {new Date(c.dueAt).toLocaleDateString("fr-CD")}
                  </TableCell>
                  <TableCell className="min-w-[240px]">
                    {actions(c)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </BoutiquePanel>
    </>
  );
}
