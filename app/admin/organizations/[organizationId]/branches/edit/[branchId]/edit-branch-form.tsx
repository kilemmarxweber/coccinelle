"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bus,
  ImagePlus,
  Pill,
  Plane,
  Ship,
  ShoppingBasket,
  Store,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { branchTypeLabel, isHospitality } from "@/lib/branch/hospitality";
import { cn } from "@/lib/utils";
import { updateBranchAction } from "../../actions";

export type EditableBranch = {
  id: string;
  type: "AGENCE" | "HOTEL" | "BOUTIQUE" | "RESTAURANT" | string;
  name: string;
  code: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED" | string;
  city: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  hasStays: boolean;
  hasRestaurant: boolean;
  hasAvion: boolean;
  hasBus: boolean;
  hasBateau: boolean;
  hasPharmacie: boolean;
  hasShop: boolean;
  hasAlimentation: boolean;
};

type Props = {
  organizationId: string;
  branch: EditableBranch;
};

export function EditBranchForm({ organizationId, branch }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [hasStays, setHasStays] = useState(branch.hasStays);
  const [hasRestaurant, setHasRestaurant] = useState(branch.hasRestaurant);
  const [hasAvion, setHasAvion] = useState(branch.hasAvion);
  const [hasBus, setHasBus] = useState(branch.hasBus);
  const [hasBateau, setHasBateau] = useState(branch.hasBateau);
  const [hasPharmacie, setHasPharmacie] = useState(branch.hasPharmacie);
  const [hasShop, setHasShop] = useState(branch.hasShop);
  const [hasAlimentation, setHasAlimentation] = useState(branch.hasAlimentation);
  const [name, setName] = useState(branch.name);
  const [code, setCode] = useState(branch.code);
  const [status, setStatus] = useState(branch.status);
  const [city, setCity] = useState(branch.city ?? "");
  const [address, setAddress] = useState(branch.address ?? "");
  const [phone, setPhone] = useState(branch.phone ?? "");
  const [email, setEmail] = useState(branch.email ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(branch.imageUrl);
  const [pending, startTransition] = useTransition();

  const hospitality = isHospitality(branch.type);
  const modulesOk = hospitality
    ? hasStays || hasRestaurant
    : branch.type === "AGENCE"
      ? hasAvion || hasBus || hasBateau
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
      toast.error("Conservez au moins un module métier.");
      return;
    }
    startTransition(async () => {
      const res = await updateBranchAction({
        organizationId,
        branchId: branch.id,
        name,
        code,
        status: status as "ACTIVE" | "SUSPENDED" | "CLOSED",
        city: city || undefined,
        address: address || undefined,
        phone: phone || undefined,
        email: email || undefined,
        imageUrl,
        hasStays: hospitality ? hasStays : undefined,
        hasRestaurant: hospitality ? hasRestaurant : undefined,
        hasAvion: branch.type === "AGENCE" ? hasAvion : undefined,
        hasBus: branch.type === "AGENCE" ? hasBus : undefined,
        hasBateau: branch.type === "AGENCE" ? hasBateau : undefined,
        hasPharmacie: branch.type === "BOUTIQUE" ? hasPharmacie : undefined,
        hasShop: branch.type === "BOUTIQUE" ? hasShop : undefined,
        hasAlimentation:
          branch.type === "BOUTIQUE" ? hasAlimentation : undefined,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Branche mise à jour.");
      router.push(`/admin/organizations/${organizationId}/branches`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Type</CardTitle>
          <CardDescription>
            Type verrouillé · {branchTypeLabel(branch.type)}. Vous pouvez ajuster
            les modules ci-dessous.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {hospitality ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  [hasStays, setHasStays, "Séjours", "Chambres & check-in"],
                  [
                    hasRestaurant,
                    setHasRestaurant,
                    "Restaurant",
                    "Carte F&B & cuisine",
                  ],
                ] as const
              ).map(([checked, set, label, hint]) => (
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
                    <span className="font-medium">{label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          {branch.type === "AGENCE" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  [hasAvion, setHasAvion, Plane, "Avion"],
                  [hasBus, setHasBus, Bus, "Bus"],
                  [hasBateau, setHasBateau, Ship, "Bateau"],
                ] as const
              ).map(([checked, set, Icon, label]) => (
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
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icon className="size-4 text-muted-foreground" />
                    {label}
                  </span>
                </label>
              ))}
            </div>
          ) : null}

          {branch.type === "BOUTIQUE" ? (
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  [hasPharmacie, setHasPharmacie, Pill, "Pharmacie"],
                  [hasShop, setHasShop, Store, "Boutique"],
                  [hasAlimentation, setHasAlimentation, ShoppingBasket, "Alimentation"],
                ] as const
              ).map(([checked, set, Icon, label]) => (
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
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icon className="size-4 text-muted-foreground" />
                    {label}
                  </span>
                </label>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Identité</CardTitle>
          <CardDescription>
            Nom, code, statut et coordonnées de la branche.
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
            <Label htmlFor="edit-branch-name">Nom</Label>
            <Input
              id="edit-branch-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              disabled={pending}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-branch-code">Code</Label>
              <Input
                id="edit-branch-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono"
                required
                minLength={2}
                disabled={pending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-branch-status">Statut</Label>
              <Select
                id="edit-branch-status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={pending}
                className="h-11"
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="CLOSED">CLOSED</option>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-branch-address">Adresse · optionnel</Label>
            <Input
              id="edit-branch-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={pending}
            />
          </div>
          <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
            <div className="grid gap-2">
              <Label htmlFor="edit-branch-city">Ville · optionnel</Label>
              <Input
                id="edit-branch-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-branch-phone">Téléphone · optionnel</Label>
              <Input
                id="edit-branch-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-branch-email">Email · optionnel</Label>
            <Input
              id="edit-branch-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="submit"
          className="h-11"
          disabled={pending || !name.trim() || !code.trim() || !modulesOk}
        >
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11"
          disabled={pending}
          render={<Link href={`/admin/organizations/${organizationId}/branches`} />}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}
