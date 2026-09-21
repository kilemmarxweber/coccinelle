"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Receipt, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { branchDashboardPath, boutiqueRoutes, caisseRoutes } from "@/lib/branch/paths";
import {
  deletePayrollTransactionAction,
  listPayrollTransactionsAction,
  updatePayrollTransactionAction,
} from "@/lib/payroll/actions";
import type {
  PayrollCapabilities,
  PayrollTransactionDto,
  PayrollTransactionKind,
} from "@/lib/payroll/types";
import { PaieSectionNav } from "../paie-nav";
import {
  BoutiqueHero,
  BoutiquePage,
  BoutiquePanel,
  BoutiqueStatus,
  boutiqueOutlineBtn,
  boutiquePrimaryBtn,
} from "@/components/boutique/boutique-shell";
import { cn } from "@/lib/utils";

type PeriodMode = "day" | "all" | "period";

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kinshasa",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function kindLabel(kind: PayrollTransactionKind) {
  return kind === "AVANCE_SALAIRE" ? "Avance" : "Salaire";
}

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  caps: PayrollCapabilities;
};

export function PayrollTransactionsClient({
  organizationId,
  branchId,
  branchName,
  caps,
}: Props) {
  const today = todayIso();
  const [rows, setRows] = useState<PayrollTransactionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<PeriodMode>("day");
  const [day, setDay] = useState(today);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [kind, setKind] = useState<"" | PayrollTransactionKind>("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [viewing, setViewing] = useState<PayrollTransactionDto | null>(null);
  const [editing, setEditing] = useState<PayrollTransactionDto | null>(null);
  const [deleting, setDeleting] = useState<PayrollTransactionDto | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editMethod, setEditMethod] = useState<"CASH" | "MOBILE_MONEY" | "BANK">(
    "CASH",
  );

  useEffect(() => {
    const handle = window.setTimeout(() => setAppliedSearch(search.trim()), 350);
    return () => window.clearTimeout(handle);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPayrollTransactionsAction({
        organizationId,
        branchId,
        mode,
        ...(mode === "day" ? { day } : {}),
        ...(mode === "period" ? { startDate, endDate } : {}),
        ...(kind ? { kind } : {}),
        search: appliedSearch || undefined,
      });
      setRows(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [
    appliedSearch,
    branchId,
    day,
    endDate,
    kind,
    mode,
    organizationId,
    startDate,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  function openEdit(row: PayrollTransactionDto) {
    setEditing(row);
    setEditAmount(String(row.amountUsd));
    setEditNote(row.note ?? "");
    setEditMethod(
      row.method === "BANK" || row.method === "MOBILE_MONEY" || row.method === "CASH"
        ? row.method
        : "CASH",
    );
  }

  function saveEdit() {
    if (!editing) return;
    start(async () => {
      try {
        await updatePayrollTransactionAction({
          organizationId,
          branchId,
          expenseId: editing.id,
          amountUsd:
            editing.kind === "AVANCE_SALAIRE"
              ? Number(editAmount)
              : undefined,
          note: editNote,
          method: editMethod,
        });
        toast.success("Transaction mise à jour.");
        setEditing(null);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Modification impossible.");
      }
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    start(async () => {
      try {
        await deletePayrollTransactionAction({
          organizationId,
          branchId,
          expenseId: deleting.id,
        });
        toast.success("Transaction supprimée.");
        setDeleting(null);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Suppression impossible.");
      }
    });
  }

  return (
    <BoutiquePage wide>
      <BoutiqueHero
        kicker={`${branchName} · journal paie`}
        title="Transactions"
        subtitle="Versements salaire et avances — voir, modifier ou supprimer, comme le journal Eteyelo."
        icon={Receipt}
        backHref={branchDashboardPath(organizationId, branchId)}
        nav={
          <PaieSectionNav
            organizationId={organizationId}
            branchId={branchId}
            active="transactions"
            showManage={caps.canManage}
            showPoint={caps.canPoint}
          />
        }
      />

      <BoutiquePanel title="Filtres" eyebrow="Période">
        <div className="flex flex-wrap items-end gap-3 p-4">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Période</span>
            <select
              className="flex h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={mode}
              onChange={(e) => setMode(e.target.value as PeriodMode)}
            >
              <option value="day">Jour</option>
              <option value="period">Intervalle</option>
              <option value="all">Tout</option>
            </select>
          </label>
          {mode === "day" ? (
            <label className="space-y-1 text-xs text-muted-foreground">
              <span>Jour</span>
              <Input
                type="date"
                className="h-10 w-[11rem]"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </label>
          ) : null}
          {mode === "period" ? (
            <>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Du</span>
                <Input
                  type="date"
                  className="h-10 w-[11rem]"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </label>
              <label className="space-y-1 text-xs text-muted-foreground">
                <span>Au</span>
                <Input
                  type="date"
                  className="h-10 w-[11rem]"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </label>
            </>
          ) : null}
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Type</span>
            <select
              className="flex h-10 rounded-lg border border-input bg-background px-3 text-sm"
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as "" | PayrollTransactionKind)
              }
            >
              <option value="">Tous</option>
              <option value="SALAIRE">Salaires</option>
              <option value="AVANCE_SALAIRE">Avances</option>
            </select>
          </label>
          <label className="min-w-[14rem] flex-1 space-y-1 text-xs text-muted-foreground">
            <span>Recherche</span>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="N°, agent, libellé…"
            />
          </label>
        </div>
      </BoutiquePanel>

      <BoutiquePanel
        title="Journal"
        eyebrow={loading ? "Chargement…" : `${rows.length} ligne(s)`}
      >
        {loading ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Chargement…</p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            Aucune transaction sur cette période.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3">Type</th>
                  <th className="p-3">Réf.</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Agent</th>
                  <th className="p-3">Montant</th>
                  <th className="p-3">Statut période</th>
                  <th className="p-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="p-3">
                      <BoutiqueStatus
                        tone={row.kind === "SALAIRE" ? "gold" : "warn"}
                      >
                        {kindLabel(row.kind)}
                      </BoutiqueStatus>
                    </td>
                    <td className="p-3 font-mono text-xs">{row.number}</td>
                    <td className="p-3 whitespace-nowrap">
                      {formatWhen(row.createdAt)}
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{row.agentName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.periodLabel ?? row.label}
                      </p>
                    </td>
                    <td className="p-3 font-semibold tabular-nums text-rose-700">
                      −{row.amountUsd.toFixed(2)} USD
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {row.periodStatus ?? "—"}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className={boutiqueOutlineBtn("h-8")}
                          onClick={() => setViewing(row)}
                        >
                          Voir
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8"
                          title="Modifier"
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8 text-destructive hover:text-destructive"
                          title="Supprimer"
                          onClick={() => setDeleting(row)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </BoutiquePanel>

      <Dialog open={viewing != null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaction {viewing?.number}</DialogTitle>
            <DialogDescription>
              {viewing ? kindLabel(viewing.kind) : ""} · {viewing?.periodLabel}
            </DialogDescription>
          </DialogHeader>
          {viewing ? (
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Agent</dt>
                <dd>{viewing.agentName ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Montant</dt>
                <dd className="font-semibold">{viewing.amountUsd.toFixed(2)} USD</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Mode</dt>
                <dd>{viewing.method ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Reçu</dt>
                <dd>{viewing.receiptNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Note</dt>
                <dd className="mt-1">{viewing.note || "—"}</dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            {viewing?.paymentId ? (
              <Button
                variant="outline"
                render={
                  <Link
                    href={caisseRoutes.receipt(
                      organizationId,
                      branchId,
                      viewing.paymentId,
                    )}
                  />
                }
              >
                Reçu caisse
              </Button>
            ) : null}
            {viewing?.payslipId ? (
              <Button
                variant="outline"
                render={
                  <Link
                    href={boutiqueRoutes.paieBulletin(
                      organizationId,
                      branchId,
                      viewing.payslipId,
                    )}
                  />
                }
              >
                Bulletin
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editing != null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier {editing?.number}</DialogTitle>
            <DialogDescription>
              {editing?.kind === "SALAIRE"
                ? "Le montant d’un salaire reste figé sur le bulletin. Vous pouvez changer la note et le mode."
                : "Montant, note et mode de versement."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {editing?.kind === "AVANCE_SALAIRE" ? (
              <div className="space-y-1">
                <Label htmlFor="tx-amount">Montant USD</Label>
                <Input
                  id="tx-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-1">
              <Label htmlFor="tx-method">Mode</Label>
              <select
                id="tx-method"
                className="flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
                value={editMethod}
                onChange={(e) =>
                  setEditMethod(e.target.value as "CASH" | "MOBILE_MONEY" | "BANK")
                }
              >
                <option value="CASH">Espèces</option>
                <option value="MOBILE_MONEY">Mobile Money</option>
                <option value="BANK">Banque</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="tx-note">Note</Label>
              <Input
                id="tx-note"
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Annuler
            </Button>
            <Button
              className={boutiquePrimaryBtn()}
              disabled={pending}
              onClick={saveEdit}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting != null} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer {deleting?.number} ?</DialogTitle>
            <DialogDescription>
              {deleting?.kind === "SALAIRE"
                ? "Le bulletin redevient non versé. La sortie de caisse est annulée."
                : "L’avance redevient approuvée, non versée. La sortie de caisse est annulée."}
            </DialogDescription>
          </DialogHeader>
          <p className={cn("text-sm", "text-foreground")}>
            {deleting?.agentName} · −{deleting?.amountUsd.toFixed(2)} USD
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={confirmDelete}
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </BoutiquePage>
  );
}
