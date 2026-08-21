"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  loadStaffPayrollProfileAction,
  saveStaffPayrollProfileAction,
} from "@/lib/payroll/actions";
import type { StaffPayoutMethod } from "@/lib/payroll/types";
import { boutiqueOutlineBtn, boutiquePrimaryBtn } from "@/components/boutique/boutique-shell";

type Props = {
  organizationId: string;
  branchId: string;
  branchMemberId: string | null;
  agentName: string;
  onClose: () => void;
};

export function EquipePayrollDialog({
  organizationId,
  branchId,
  branchMemberId,
  agentName,
  onClose,
}: Props) {
  const [pending, start] = useTransition();
  const [dailyRate, setDailyRate] = useState("");
  const [defaultRate, setDefaultRate] = useState(10);
  const [method, setMethod] = useState<StaffPayoutMethod>("MOBILE_MONEY");
  const [mobile, setMobile] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  useEffect(() => {
    if (!branchMemberId) return;
    start(async () => {
      try {
        const data = await loadStaffPayrollProfileAction(
          organizationId,
          branchId,
          branchMemberId,
        );
        setDefaultRate(data.defaultDailyRateUsd);
        setDailyRate(
          data.profile.dailyRateUsd != null
            ? String(data.profile.dailyRateUsd)
            : "",
        );
        setMethod(data.profile.payoutMethod);
        setMobile(data.profile.mobileMoneyPhone ?? "");
        setBankName(data.profile.bankName ?? "");
        setBankAccount(data.profile.bankAccount ?? "");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Chargement impossible.");
      }
    });
  }, [organizationId, branchId, branchMemberId]);

  function save() {
    if (!branchMemberId) return;
    const override = dailyRate.trim();
    start(async () => {
      try {
        await saveStaffPayrollProfileAction({
          organizationId,
          branchId,
          branchMemberId,
          dailyRateUsd: override ? Number(override) : null,
          payoutMethod: method,
          mobileMoneyPhone: mobile,
          bankName,
          bankAccount,
        });
        toast.success("Profil de paie enregistré.");
        onClose();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
      }
    });
  }

  return (
    <Dialog open={Boolean(branchMemberId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#0f3d2e]">Paie & versement</DialogTitle>
          <DialogDescription>
            {agentName} · défaut branche {defaultRate.toFixed(2)} USD / jour
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rate">Taux journalier (USD) — vide = défaut</Label>
            <Input
              id="rate"
              type="number"
              min="0"
              step="0.5"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              placeholder={String(defaultRate)}
              className="h-11"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="method">Moyen de versement</Label>
            <Select
              id="method"
              value={method}
              onChange={(e) => setMethod(e.target.value as StaffPayoutMethod)}
              className="h-11 w-full"
            >
              <option value="MOBILE_MONEY">Mobile Money</option>
              <option value="BANK">Banque</option>
              <option value="CASH">Espèces</option>
            </Select>
          </div>
          {method === "MOBILE_MONEY" ? (
            <div className="grid gap-1.5">
              <Label htmlFor="mm">Téléphone Mobile Money</Label>
              <Input
                id="mm"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="+243…"
                className="h-11"
              />
            </div>
          ) : null}
          {method === "BANK" ? (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="bn">Banque</Label>
                <Input
                  id="bn"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ba">N° de compte</Label>
                <Input
                  id="ba"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                  className="h-11"
                />
              </div>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className={boutiqueOutlineBtn()} onClick={onClose}>
            Annuler
          </Button>
          <Button type="button" disabled={pending} className={boutiquePrimaryBtn()} onClick={save}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
