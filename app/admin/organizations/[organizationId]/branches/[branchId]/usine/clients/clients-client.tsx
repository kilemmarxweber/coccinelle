"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, UserRound, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BoutiqueHero,
  BoutiqueKpis,
  BoutiquePage,
  BoutiquePanel,
  BoutiqueStatus,
} from "@/components/boutique/boutique-shell";
import { upsertFactoryCustomerAction } from "@/lib/factory/actions";
import { branchDashboardPath } from "@/lib/branch/paths";

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  contactName: string | null;
  companyName: string | null;
  email: string | null;
  active: boolean;
  _count: { credits: number; reservations: number };
};

export function UsineClientsClient(props: {
  organizationId: string;
  branchId: string;
  customers: Customer[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.customers;
    return props.customers.filter((c) =>
      [c.name, c.phone, c.companyName, c.contactName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [props.customers, search]);

  const withCredits = props.customers.filter((c) => c._count.credits > 0).length;
  const withReservations = props.customers.filter(
    (c) => c._count.reservations > 0,
  ).length;

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker="Usine"
        title="Clients"
        subtitle="Nom et téléphone obligatoires pour un crédit. Société optionnelle."
        icon={Users}
        backHref={branchDashboardPath(props.organizationId, props.branchId)}
      />
      <BoutiqueKpis
        items={[
          { label: "Fiches", value: props.customers.length },
          { label: "Avec crédit", value: withCredits },
          { label: "Avec hold", value: withReservations },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:items-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              try {
                await upsertFactoryCustomerAction({
                  organizationId: props.organizationId,
                  branchId: props.branchId,
                  name,
                  phone,
                  companyName,
                  contactName,
                });
                toast.success("Client enregistré");
                setName("");
                setPhone("");
                setCompanyName("");
                setContactName("");
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Erreur");
              }
            });
          }}
        >
        <BoutiquePanel
          title="Nouveau client"
          icon={UserRound}
          bodyClassName="grid gap-3 p-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="client-name">Nom</Label>
            <Input
              id="client-name"
              className="h-10 rounded-xl"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-phone">Téléphone</Label>
            <Input
              id="client-phone"
              className="h-10 rounded-xl"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              inputMode="tel"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-company">Société</Label>
            <Input
              id="client-company"
              className="h-10 rounded-xl"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Optionnel"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="client-contact">Contact</Label>
            <Input
              id="client-contact"
              className="h-10 rounded-xl"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Optionnel"
            />
          </div>
          <Button
            type="submit"
            disabled={pending}
            className="h-11 w-full"
          >
            Enregistrer
          </Button>
        </BoutiquePanel>
        </form>

        <BoutiquePanel
          title="Fichier clients"
          eyebrow={`${filtered.length}`}
          bodyClassName="p-0"
          actions={
            <div className="relative w-full max-w-[220px]">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher…"
                className="h-9 rounded-full pl-8"
              />
            </div>
          }
        >
          {filtered.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="Aucun client"
              description="Enregistrez une fiche à gauche pour vendre à crédit ou réserver."
            />
          ) : (
            <>
              <ul className="divide-y divide-border lg:hidden">
                {filtered.map((c) => (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{c.name}</p>
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                          {[c.companyName, c.phone, c.contactName]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <BoutiqueStatus tone={c.active ? "ok" : "neutral"}>
                        {c._count.credits} crédit
                        {c._count.credits === 1 ? "" : "s"}
                      </BoutiqueStatus>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Nom</TableHead>
                      <TableHead>Téléphone</TableHead>
                      <TableHead>Société</TableHead>
                      <TableHead className="text-right">Crédits</TableHead>
                      <TableHead className="text-right">Réservations</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium whitespace-normal">
                          {c.name}
                          {c.contactName ? (
                            <p className="text-[11px] font-normal text-muted-foreground">
                              {c.contactName}
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {c.phone ?? "—"}
                        </TableCell>
                        <TableCell>{c.companyName ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c._count.credits}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c._count.reservations}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </BoutiquePanel>
      </div>
    </BoutiquePage>
  );
}
