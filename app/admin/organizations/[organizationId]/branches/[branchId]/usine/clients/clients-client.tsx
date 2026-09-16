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
import {
  inviteFactoryCustomerAccountAction,
  upsertFactoryCustomerAction,
} from "@/lib/factory/actions";
import { branchDashboardPath } from "@/lib/branch/paths";

type AffiliateBranch = {
  id: string;
  name: string;
  type: string;
  code: string;
};

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  contactName: string | null;
  companyName: string | null;
  email: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  affiliateBranchId: string | null;
  userId: string | null;
  active: boolean;
  affiliateBranch: { id: string; name: string; type: string } | null;
  user: { id: string; email: string; name: string } | null;
  _count: { credits: number; reservations: number; orderRequests: number };
};

export function UsineClientsClient(props: {
  organizationId: string;
  branchId: string;
  customers: Customer[];
  affiliateBranches: AffiliateBranch[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");
  const [affiliateBranchId, setAffiliateBranchId] = useState("");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.customers;
    return props.customers.filter((c) =>
      [
        c.name,
        c.phone,
        c.companyName,
        c.contactName,
        c.email,
        c.affiliateBranch?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [props.customers, search]);

  const withCredits = props.customers.filter((c) => c._count.credits > 0).length;
  const withAccount = props.customers.filter((c) => c.userId).length;

  function invite(customerId: string) {
    start(async () => {
      const res = await inviteFactoryCustomerAccountAction({
        organizationId: props.organizationId,
        branchId: props.branchId,
        customerId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const wa = res.whatsappSent
        ? " · WhatsApp envoyé"
        : " · WhatsApp non envoyé (vérifiez KlamboWhatsApp)";
      toast.success(
        `Compte : ${res.email} · MDP : ${res.temporaryPassword}${wa}`,
        { duration: 14_000 },
      );
      router.refresh();
    });
  }

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker="Usine"
        title="Clients affiliés"
        subtitle="Entreprise + contact. Compte optionnel : invitation WhatsApp automatique."
        icon={Users}
        backHref={branchDashboardPath(props.organizationId, props.branchId)}
      />
      <BoutiqueKpis
        items={[
          { label: "Fiches", value: props.customers.length },
          { label: "Avec crédit", value: withCredits },
          { label: "Avec compte", value: withAccount },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] lg:items-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              try {
                await upsertFactoryCustomerAction({
                  organizationId: props.organizationId,
                  branchId: props.branchId,
                  name: companyName.trim() || name,
                  phone,
                  companyName,
                  contactName: contactName || name,
                  email,
                  deliveryAddress,
                  deliveryCity,
                  affiliateBranchId: affiliateBranchId || null,
                });
                toast.success(
                  phone.trim()
                    ? "Client enregistré · WhatsApp de bienvenue envoyé"
                    : "Client enregistré",
                );
                setName("");
                setPhone("");
                setCompanyName("");
                setContactName("");
                setEmail("");
                setDeliveryAddress("");
                setDeliveryCity("");
                setAffiliateBranchId("");
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
              <Label htmlFor="client-company">Entreprise</Label>
              <Input
                id="client-company"
                className="h-10 rounded-xl"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                placeholder="Boutique / resto"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="client-contact">Contact (nom)</Label>
              <Input
                id="client-contact"
                className="h-10 rounded-xl"
                value={contactName}
                onChange={(e) => {
                  setContactName(e.target.value);
                  setName(e.target.value);
                }}
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
              <Label htmlFor="client-email">Email (compte optionnel)</Label>
              <Input
                id="client-email"
                type="email"
                className="h-10 rounded-xl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="client-address">Adresse livraison</Label>
              <Input
                id="client-address"
                className="h-10 rounded-xl"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="client-city">Ville</Label>
              <Input
                id="client-city"
                className="h-10 rounded-xl"
                value={deliveryCity}
                onChange={(e) => setDeliveryCity(e.target.value)}
                placeholder="Optionnel"
              />
            </div>
            {props.affiliateBranches.length > 0 ? (
              <div className="grid gap-1.5">
                <Label htmlFor="client-affiliate">Branche Coccinelle</Label>
                <select
                  id="client-affiliate"
                  className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
                  value={affiliateBranchId}
                  onChange={(e) => setAffiliateBranchId(e.target.value)}
                >
                  <option value="">Externe (hors Coccinelle)</option>
                  {props.affiliateBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} · {b.type}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <Button type="submit" disabled={pending} className="h-11 w-full">
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
              description="Enregistrez une entreprise affiliée pour vendre à crédit."
            />
          ) : (
            <>
              <ul className="divide-y divide-border lg:hidden">
                {filtered.map((c) => (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {c.companyName || c.name}
                        </p>
                        <p className="mt-0.5 truncate text-[12px] text-muted-foreground">
                          {[c.contactName, c.phone, c.affiliateBranch?.name]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <BoutiqueStatus>
                            {c._count.credits} crédit(s)
                          </BoutiqueStatus>
                          {c.userId ? (
                            <BoutiqueStatus>Compte</BoutiqueStatus>
                          ) : null}
                        </div>
                      </div>
                      {!c.userId ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => invite(c.id)}
                        >
                          Inviter
                        </Button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entreprise</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Affiliation</TableHead>
                      <TableHead>Compte</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {c.companyName || c.name}
                          <div className="text-xs text-muted-foreground">
                            {c.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.contactName || "—"}
                          <div className="text-xs text-muted-foreground">
                            {c.email || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.affiliateBranch
                            ? c.affiliateBranch.name
                            : "Externe"}
                        </TableCell>
                        <TableCell>
                          {c.user ? c.user.email : "Sans compte"}
                        </TableCell>
                        <TableCell className="text-right">
                          {!c.userId ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => invite(c.id)}
                            >
                              Inviter
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Actif
                            </span>
                          )}
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
