"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Hotel, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { createBranchWithBootstrapAction } from "../../actions";

const TYPES = [
  {
    value: "AGENCE" as const,
    label: "Agence",
    description: "Voyages, billets, réservations, colis, cashpaye guichet.",
    icon: Building2,
    bootstrap: "Trajets démo Kinshasa → Lubumbashi / Matadi",
  },
  {
    value: "HOTEL" as const,
    label: "Hôtel",
    description: "Chambres, séjours, restauration, cashpaye réception.",
    icon: Hotel,
    bootstrap: "Types Standard + Suite et inventaire chambres",
  },
  {
    value: "BOUTIQUE" as const,
    label: "Boutique",
    description: "Produits, stock, ventes POS, cashpaye caisse.",
    icon: Store,
    bootstrap: "Catégories Boissons / Divers + produits en stock",
  },
];

type Props = {
  organizationId: string;
  organizationName: string;
};

export function CreateBranchForm({ organizationId, organizationName }: Props) {
  const router = useRouter();
  const [type, setType] = useState<"AGENCE" | "HOTEL" | "BOUTIQUE">("AGENCE");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [seedDemo, setSeedDemo] = useState(true);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createBranchWithBootstrapAction({
        organizationId,
        type,
        name,
        code,
        city: city || undefined,
        seedDemo,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const b = res.bootstrap;
      toast.success("Branche créée", {
        description: `Bootstrap : ${b.trajetsCreated} trajets, ${b.roomsCreated} chambres, ${b.productsCreated} produits.`,
      });
      router.push(`/admin/organizations/${organizationId}/branches`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-xl font-semibold">Nouvelle branche</h1>
        <p className="text-sm text-muted-foreground">
          Organisation « {organizationName} » — choisissez le type puis chargez les éléments
          nécessaires.
        </p>
      </div>

      <div className="grid gap-3">
        {TYPES.map((t) => {
          const Icon = t.icon;
          const selected = type === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setType(t.value)}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition",
                selected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-border hover:border-primary/40",
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{t.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {t.description}
                </span>
                <span className="mt-1 block text-xs text-primary">{t.bootstrap}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identité de la branche</CardTitle>
          <CardDescription>Nom affiché et code unique dans l’organisation.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="branch-name">Nom</Label>
            <Input
              id="branch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                type === "AGENCE"
                  ? "Agence Gombe"
                  : type === "HOTEL"
                    ? "Hôtel Fleuve"
                    : "Boutique Victoire"
              }
              required
              minLength={2}
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-code">Code</Label>
            <Input
              id="branch-code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="AG-GOMBE"
              className="font-mono"
              required
              minLength={2}
              disabled={pending}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-city">Ville (optionnel)</Label>
            <Input
              id="branch-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Kinshasa"
              disabled={pending}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={seedDemo}
              onCheckedChange={(v) => setSeedDemo(v === true)}
              disabled={pending}
            />
            Charger les éléments démo pour ce type
          </label>
        </CardContent>
      </Card>

      <Button type="submit" className="h-11" disabled={pending || !name.trim() || !code.trim()}>
        {pending ? "Création…" : "Créer la branche"}
      </Button>
    </form>
  );
}
