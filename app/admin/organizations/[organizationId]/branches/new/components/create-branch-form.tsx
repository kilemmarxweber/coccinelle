"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Building2, Hotel, ImagePlus, Store } from "lucide-react";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<"AGENCE" | "HOTEL" | "BOUTIQUE">("AGENCE");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [seedDemo, setSeedDemo] = useState(true);
  const [pending, startTransition] = useTransition();

  async function onPickImage(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image (JPEG, PNG, WebP…).");
      return;
    }
    if (file.size > 512_000) {
      toast.error("Image trop volumineuse (max. 512 Ko).");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Lecture image impossible"));
      reader.readAsDataURL(file);
    });
    setImageUrl(dataUrl);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await createBranchWithBootstrapAction({
        organizationId,
        type,
        name,
        code,
        city: city || undefined,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        imageUrl,
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
          <CardDescription>
            Nom, code, logo et coordonnées (utilisés sur les rapports).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40"
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <ImagePlus className="size-5 text-muted-foreground" />
              )}
            </button>
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label>Logo / image · optionnel</Label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={pending}
                >
                  Choisir
                </Button>
                {imageUrl ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setImageUrl(null)}
                    disabled={pending}
                  >
                    Retirer
                  </Button>
                ) : null}
              </div>
              <p className="text-[11px] text-muted-foreground">
                JPEG / PNG / WebP · max. 512 Ko
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                void onPickImage(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </div>

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
            <Label htmlFor="branch-address">Adresse · optionnel</Label>
            <Input
              id="branch-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="12 av. du Commerce"
              disabled={pending}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-2">
              <Label htmlFor="branch-city">Ville · optionnel</Label>
              <Input
                id="branch-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Kinshasa"
                disabled={pending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="branch-phone">Téléphone · optionnel</Label>
              <Input
                id="branch-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+243 …"
                disabled={pending}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="branch-email">Email · optionnel</Label>
            <Input
              id="branch-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="branche@exemple.com"
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
