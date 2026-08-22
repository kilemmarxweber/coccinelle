"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Bus,
  Hotel,
  ImagePlus,
  Pill,
  Plane,
  Ship,
  ShoppingBasket,
  Store,
  UtensilsCrossed,
  Factory,
} from "lucide-react";
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
    description: "Voyages — choisissez Avion, Bus et/ou Bateau.",
    icon: Building2,
    bootstrap: "Trajets démo selon les modes cochés",
  },
  {
    value: "HOTEL" as const,
    label: "Hôtellerie-restaurant",
    description:
      "Hôtel et/ou restaurant — choisissez les modules ci-dessous.",
    icon: Hotel,
    bootstrap: "Seed selon modules : chambres et/ou carte F&B",
  },
  {
    value: "BOUTIQUE" as const,
    label: "Commerce",
    description: "Pharmacie, boutique et/ou alimentation.",
    icon: Store,
    bootstrap: "Catalogue démo selon les verticales cochées",
  },
  {
    value: "USINE" as const,
    label: "Usine",
    description: "Production et vente cash / crédit — catalogue libre (plusieurs types de produits).",
    icon: Factory,
    bootstrap: "Catalogue démo (finis + consommables) + paie commerce",
  },
];

type BranchFormType = "AGENCE" | "HOTEL" | "BOUTIQUE" | "USINE";

type Props = {
  organizationId: string;
  organizationName: string;
};

export function CreateBranchForm({ organizationId, organizationName }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<BranchFormType>("AGENCE");
  const [hasStays, setHasStays] = useState(true);
  const [hasRestaurant, setHasRestaurant] = useState(true);
  const [hasAvion, setHasAvion] = useState(true);
  const [hasBus, setHasBus] = useState(true);
  const [hasBateau, setHasBateau] = useState(false);
  const [hasPharmacie, setHasPharmacie] = useState(false);
  const [hasShop, setHasShop] = useState(true);
  const [hasAlimentation, setHasAlimentation] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [seedDemo, setSeedDemo] = useState(true);
  const [pending, startTransition] = useTransition();

  const modulesOk =
    type === "HOTEL"
      ? hasStays || hasRestaurant
      : type === "AGENCE"
        ? hasAvion || hasBus || hasBateau
        : type === "USINE"
          ? true
          : hasPharmacie || hasShop || hasAlimentation;

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
    if (!modulesOk) {
      toast.error(
        type === "AGENCE"
          ? "Choisissez au moins Avion, Bus ou Bateau."
          : type === "BOUTIQUE"
            ? "Choisissez au moins Pharmacie, Boutique ou Alimentation."
            : "Choisissez au moins Séjours ou Restaurant.",
      );
      return;
    }
    startTransition(async () => {
      const res = await createBranchWithBootstrapAction({
        organizationId,
        type,
        hasStays: type === "HOTEL" ? hasStays : undefined,
        hasRestaurant: type === "HOTEL" ? hasRestaurant : undefined,
        hasAvion: type === "AGENCE" ? hasAvion : undefined,
        hasBus: type === "AGENCE" ? hasBus : undefined,
        hasBateau: type === "AGENCE" ? hasBateau : undefined,
        hasPharmacie: type === "BOUTIQUE" ? hasPharmacie : undefined,
        hasShop: type === "BOUTIQUE" ? hasShop : undefined,
        hasAlimentation: type === "BOUTIQUE" ? hasAlimentation : undefined,
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
        description: `Bootstrap : ${b.trajetsCreated} trajets, ${b.roomsCreated} chambres, ${b.productsCreated} produits${b.menuItemsCreated ? `, ${b.menuItemsCreated} plats` : ""}.`,
      });
      router.push(`/admin/organizations/${organizationId}/branches`);
      router.refresh();
    });
  }

  const namePlaceholder =
    type === "AGENCE"
      ? "Agence Gombe"
      : type === "HOTEL"
        ? !hasStays && hasRestaurant
          ? "Restaurant Riviera"
          : "Hôtel Fleuve"
        : type === "USINE"
          ? "Usine Kwilu"
          : hasPharmacie && !hasShop && !hasAlimentation
            ? "Pharmacie Centrale"
            : hasAlimentation && !hasShop && !hasPharmacie
              ? "Alimentation Marché"
              : "Boutique Victoire";

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
      <div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 mb-1 gap-1.5 text-muted-foreground hover:text-foreground"
          disabled={pending}
          render={
            <Link href={`/admin/organizations/${organizationId}/branches`} />
          }
        >
          <ArrowLeft className="size-4" />
          Liste des branches
        </Button>
        <h1 className="text-xl font-semibold">Nouvelle branche</h1>
        <p className="text-sm text-muted-foreground">
          Organisation « {organizationName} » — choisissez le type puis les
          modules métier.
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

      {type === "AGENCE" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Modes de transport</CardTitle>
            <CardDescription>
              Au moins un mode. Les trajets démo suivent votre sélection.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {(
              [
                [hasAvion, setHasAvion, Plane, "Avion", "Vols & billets aériens", "text-sky-500"],
                [hasBus, setHasBus, Bus, "Bus", "Lignes routières", "text-emerald-500"],
                [hasBateau, setHasBateau, Ship, "Bateau", "Liaisons fluviales", "text-indigo-500"],
              ] as const
            ).map(([checked, set, Icon, label, hint, color]) => (
              <label
                key={label}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                  checked ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => set(v === true)}
                  disabled={pending}
                />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icon className={cn("size-4", color)} />
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {hint}
                  </span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {type === "HOTEL" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Modules hôtellerie-restaurant</CardTitle>
            <CardDescription>
              Au moins un module. Livraison stock commune. Type final :{" "}
              <strong>
                {!hasStays && hasRestaurant
                  ? "Restaurant"
                  : hasStays
                    ? "Hôtel"
                    : "—"}
              </strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                hasStays ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <Checkbox
                checked={hasStays}
                onCheckedChange={(v) => setHasStays(v === true)}
                disabled={pending}
              />
              <span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Hotel className="size-4 text-sky-500" />
                  Séjours
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Chambres, check-in / check-out, folios nuitées.
                </span>
              </span>
            </label>
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                hasRestaurant ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <Checkbox
                checked={hasRestaurant}
                onCheckedChange={(v) => setHasRestaurant(v === true)}
                disabled={pending}
              />
              <span>
                <span className="flex items-center gap-1.5 font-medium">
                  <UtensilsCrossed className="size-4 text-violet-500" />
                  Restaurant
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Restauration, cuisine, produits F&B.
                </span>
              </span>
            </label>
          </CardContent>
        </Card>
      ) : null}

      {type === "BOUTIQUE" ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Verticales commerce</CardTitle>
            <CardDescription>
              Au moins une verticale. Le catalogue démo suit votre sélection.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            {(
              [
                [
                  hasPharmacie,
                  setHasPharmacie,
                  Pill,
                  "Pharmacie",
                  "Médicaments & parapharmacie",
                  "text-rose-500",
                ],
                [
                  hasShop,
                  setHasShop,
                  Store,
                  "Boutique",
                  "Commerce général / accessoires",
                  "text-violet-500",
                ],
                [
                  hasAlimentation,
                  setHasAlimentation,
                  ShoppingBasket,
                  "Alimentation",
                  "Épicerie & denrées",
                  "text-amber-600",
                ],
              ] as const
            ).map(([checked, set, Icon, label, hint, color]) => (
              <label
                key={label}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                  checked ? "border-primary bg-primary/5" : "border-border",
                )}
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => set(v === true)}
                  disabled={pending}
                />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icon className={cn("size-4", color)} />
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {hint}
                  </span>
                </span>
              </label>
            ))}
          </CardContent>
        </Card>
      ) : null}

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
              placeholder={namePlaceholder}
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

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button
          type="submit"
          className="h-11"
          disabled={pending || !name.trim() || !code.trim() || !modulesOk}
        >
          {pending ? "Création…" : "Créer la branche"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-1.5"
          disabled={pending}
          render={
            <Link href={`/admin/organizations/${organizationId}/branches`} />
          }
        >
          <ArrowLeft className="size-4" />
          Retour à la liste
        </Button>
      </div>
    </form>
  );
}
