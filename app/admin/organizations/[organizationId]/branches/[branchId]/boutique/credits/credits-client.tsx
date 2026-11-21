"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upsertDeptCustomerAction } from "@/lib/dept-credit/actions";
import {
  BoutiqueHero,
  BoutiquePage,
} from "@/components/boutique/boutique-shell";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  creditLimitUsd: number;
  openUsd: number;
};

export function CreditsClient(props: {
  organizationId: string;
  branchId: string;
  customers: Customer[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [limit, setLimit] = useState("0");

  function save() {
    start(async () => {
      try {
        await upsertDeptCustomerAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          name,
          phone,
          creditLimitUsd: Number(limit) || 0,
        });
        setName("");
        setPhone("");
        setLimit("0");
        toast.success("Client crédit enregistré");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker="Crédit"
        title="Clientèle à crédit"
        subtitle="Plafond, solde ouvert. Un dépassement est bloqué. CA ≠ créance ≠ encaissé."
      />
      <div className="grid gap-3 rounded-2xl border border-border p-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label>Nom</Label>
          <Input className="h-11" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Téléphone</Label>
          <Input className="h-11" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Plafond USD</Label>
          <Input
            className="h-11"
            type="number"
            min={0}
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
        </div>
        <Button className="h-11 sm:col-span-3" disabled={pending} onClick={save}>
          Enregistrer
        </Button>
      </div>
      <ul className="space-y-2">
        {props.customers.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3"
          >
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-muted-foreground">{c.phone || "—"}</p>
            </div>
            <p className="text-sm">
              Ouvert {c.openUsd.toFixed(2)} $ / plafond {c.creditLimitUsd.toFixed(2)} $
            </p>
          </li>
        ))}
      </ul>
    </BoutiquePage>
  );
}
