"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Handshake, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BoutiqueHero,
  BoutiqueKpis,
  BoutiquePage,
  BoutiquePanel,
  BoutiqueStatus,
} from "@/components/boutique/boutique-shell";
import { branchDashboardPath } from "@/lib/branch/paths";
import { upsertFactorySupplierAction } from "@/lib/factory/actions";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  contactName: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
};

export function UsineFournisseursClient(props: {
  organizationId: string;
  branchId: string;
  suppliers: Supplier[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [contactName, setContactName] = useState("");
  const [address, setAddress] = useState("");
  const activeCount = props.suppliers.filter((s) => s.active).length;

  function save() {
    start(async () => {
      try {
        await upsertFactorySupplierAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          name,
          phone,
          contactName,
          address,
        });
        toast.success("Fournisseur enregistré");
        setName("");
        setPhone("");
        setContactName("");
        setAddress("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker="Usine"
        title="Fournisseurs"
        subtitle="Fiches obligatoires sur chaque bon de commande usine."
        icon={Handshake}
        backHref={branchDashboardPath(props.organizationId, props.branchId)}
      />
      <BoutiqueKpis
        items={[
          { label: "Enregistrés", value: props.suppliers.length },
          { label: "Actifs", value: activeCount, tone: "ok" },
          {
            label: "Inactifs",
            value: props.suppliers.length - activeCount,
            tone: props.suppliers.length - activeCount ? "warn" : "default",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(280px,380px)_minmax(0,1fr)] lg:items-start">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <BoutiquePanel
            title="Nouveau fournisseur"
            icon={Truck}
            bodyClassName="grid gap-3 p-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="sup-name">Nom</Label>
              <Input
                id="sup-name"
                className="h-10 rounded-xl"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sup-contact">Contact</Label>
              <Input
                id="sup-contact"
                className="h-10 rounded-xl"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sup-phone">Téléphone</Label>
              <Input
                id="sup-phone"
                className="h-10 rounded-xl"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sup-address">Adresse</Label>
              <Input
                id="sup-address"
                className="h-10 rounded-xl"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={pending} className="h-10">
              Enregistrer
            </Button>
          </BoutiquePanel>
        </form>

        <BoutiquePanel
          title="Fichier fournisseurs"
          eyebrow={`${props.suppliers.length}`}
          bodyClassName="p-0"
        >
          {props.suppliers.length === 0 ? (
            <EmptyState
              icon={Handshake}
              title="Aucun fournisseur"
              description="Ajoutez une fiche pour pouvoir créer un bon de commande."
            />
          ) : (
            <ul className="divide-y divide-border">
              {props.suppliers.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">{s.name}</p>
                      <BoutiqueStatus tone={s.active ? "ok" : "neutral"}>
                        {s.active ? "Actif" : "Inactif"}
                      </BoutiqueStatus>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[s.contactName, s.phone, s.address]
                        .filter(Boolean)
                        .join(" · ") || "—"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      start(async () => {
                        await upsertFactorySupplierAction({
                          organizationId: props.organizationId,
                          branchId: props.branchId,
                          id: s.id,
                          name: s.name,
                          phone: s.phone ?? undefined,
                          contactName: s.contactName ?? undefined,
                          address: s.address ?? undefined,
                          active: !s.active,
                        });
                        router.refresh();
                      })
                    }
                  >
                    {s.active ? "Désactiver" : "Activer"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </BoutiquePanel>
      </div>
    </BoutiquePage>
  );
}
