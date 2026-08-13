"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createBranchPartnerAction,
  setBranchPartnerStatusAction,
  updateBranchPartnerAction,
} from "@/lib/partners/actions";
import type { BranchPartnerDTO } from "@/lib/partners/types";

type FormState = {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  taxId: string;
  notes: string;
};

const emptyForm = (): FormState => ({
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  taxId: "",
  notes: "",
});

function fromPartner(p: BranchPartnerDTO): FormState {
  return {
    name: p.name,
    contactName: p.contactName ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    address: p.address,
    city: p.city,
    taxId: p.taxId ?? "",
    notes: p.notes ?? "",
  };
}

export function PartnersClient(props: {
  organizationId: string;
  branchId: string;
  partners: BranchPartnerDTO[];
  variant: "hotel" | "agence";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BranchPartnerDTO | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return props.partners.filter((p) => {
      if (!showInactive && p.status !== "ACTIVE") return false;
      if (!needle) return true;
      return [p.name, p.contactName, p.phone, p.city, p.address]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [props.partners, q, showInactive]);

  const subtitle =
    props.variant === "hotel"
      ? "Sociétés — coordonnées, réservations chambres / salles."
      : "Sociétés & clients — coordonnées pour l’agence.";

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(p: BranchPartnerDTO) {
    setEditing(p);
    setForm(fromPartner(p));
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      try {
        const payload = {
          organizationId: props.organizationId,
          branchId: props.branchId,
          name: form.name,
          contactName: form.contactName || null,
          phone: form.phone || null,
          email: form.email || null,
          address: form.address,
          city: form.city,
          taxId: form.taxId || null,
          notes: form.notes || null,
        };
        if (editing) {
          await updateBranchPartnerAction({
            ...payload,
            partnerId: editing.id,
            status: editing.status,
          });
          toast.success("Partenaire mis à jour");
        } else {
          await createBranchPartnerAction(payload);
          toast.success("Partenaire créé");
        }
        setOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function toggleStatus(p: BranchPartnerDTO) {
    startTransition(async () => {
      try {
        await setBranchPartnerStatusAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          partnerId: p.id,
          status: p.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
        });
        toast.success(
          p.status === "ACTIVE" ? "Partenaire désactivé" : "Partenaire réactivé",
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Clients partenaires
          </h1>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          Nouveau partenaire
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Nom, contact, tél, ville…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Afficher inactifs
        </label>
      </div>

      <ul className="divide-y rounded-xl border bg-card">
        {filtered.length === 0 ? (
          <li className="p-8 text-center text-sm text-muted-foreground">
            Aucun partenaire{q ? " pour cette recherche" : ""}.
          </li>
        ) : (
          filtered.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Building2 className="size-4 text-muted-foreground" />
                  <span className="font-medium">{p.name}</span>
                  <Badge
                    variant={p.status === "ACTIVE" ? "default" : "secondary"}
                  >
                    {p.status === "ACTIVE" ? "Actif" : "Inactif"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {p.contactName ? (
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="size-3.5" />
                      {p.contactName}
                      {p.phone ? ` · ${p.phone}` : ""}
                    </span>
                  ) : (
                    p.phone || "—"
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {p.address}, {p.city}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(p)}
                >
                  Modifier
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => toggleStatus(p)}
                >
                  {p.status === "ACTIVE" ? "Désactiver" : "Réactiver"}
                </Button>
              </div>
            </li>
          ))
        )}
      </ul>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Modifier le partenaire" : "Nouveau partenaire"}
            </DialogTitle>
            <DialogDescription>
              Société / organisation — adresse obligatoire. La pièce d’identité
              se saisit sur le séjour pour un client individuel.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Raison sociale / nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Contact</Label>
                <Input
                  value={form.contactName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, contactName: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Téléphone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Adresse *</Label>
              <Input
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
                placeholder="Rue, avenue, quartier…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Ville *</Label>
                <Input
                  value={form.city}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, city: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label>NIF / RCCM</Label>
                <Input
                  value={form.taxId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, taxId: e.target.value }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="button" disabled={pending} onClick={save}>
              {pending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
