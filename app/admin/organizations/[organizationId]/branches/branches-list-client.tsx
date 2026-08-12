"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  Hotel,
  MoreHorizontal,
  Pencil,
  Store,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ResponsiveDialog,
  ResponsiveDialogClose,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import {
  agencyModesLabel,
  shopVerticalsLabel,
} from "@/lib/branch/agency-shop";
import { branchTypeLabel, isHospitality } from "@/lib/branch/hospitality";
import { cn } from "@/lib/utils";
import { deleteBranchAction } from "./actions";

const TYPE_META = {
  AGENCE: {
    label: "Agence",
    icon: Building2,
    iconBg: "bg-emerald-500/15",
    iconColor: "text-emerald-400",
  },
  HOTEL: {
    label: "Hôtel",
    icon: Hotel,
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-400",
  },
  RESTAURANT: {
    label: "Restaurant",
    icon: UtensilsCrossed,
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-400",
  },
  BOUTIQUE: {
    label: "Boutique",
    icon: Store,
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-400",
  },
} as const;

export type BranchListItem = {
  id: string;
  type: keyof typeof TYPE_META | string;
  name: string;
  code: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED" | string;
  city: string | null;
  hasStays: boolean;
  hasRestaurant: boolean;
  hasAvion: boolean;
  hasBus: boolean;
  hasBateau: boolean;
  hasPharmacie: boolean;
  hasShop: boolean;
  hasAlimentation: boolean;
  _count: {
    trajets: number;
    hotelRoomTypes: number;
    shopCategories: number;
    menuItems: number;
    members: number;
  };
};

type Props = {
  organizationId: string;
  branches: BranchListItem[];
};

export function BranchesListClient({ organizationId, branches }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<BranchListItem | null>(null);

  function confirmDelete() {
    if (!toDelete) return;
    const target = toDelete;
    startTransition(async () => {
      const res = await deleteBranchAction({
        organizationId,
        branchId: target.id,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(`Branche « ${target.name} » supprimée.`);
      setToDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => {
          const meta =
            TYPE_META[b.type as keyof typeof TYPE_META] ?? {
              label: branchTypeLabel(b.type),
              icon: Building2,
              iconBg: "bg-muted",
              iconColor: "text-muted-foreground",
            };
          const Icon = meta.icon;
          const canOpen = b.status === "ACTIVE";
          const stats =
            b.type === "AGENCE"
              ? `${b._count.trajets} trajets · ${agencyModesLabel(b)}`
              : isHospitality(b.type)
                ? [
                    b.hasStays
                      ? `${b._count.hotelRoomTypes} types chambres`
                      : null,
                    b.hasRestaurant
                      ? `${b._count.menuItems} produits F&B`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Hôtellerie-restaurant"
                : `${b._count.shopCategories} cat. · ${shopVerticalsLabel(b)}`;
          const href = `/admin/organizations/${organizationId}/branches/${b.id}`;
          const detailBadge =
            b.type === "AGENCE"
              ? agencyModesLabel(b)
              : b.type === "BOUTIQUE"
                ? shopVerticalsLabel(b)
                : meta.label;

          return (
            <div key={b.id} className="group relative">
              <Link
                href={href}
                className={cn(
                  "flex items-start gap-3.5 rounded-xl border bg-card p-4 pr-14 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
                  canOpen
                    ? "border-primary/50 hover:border-primary hover:shadow-primary/15"
                    : "border-border hover:border-primary/40 hover:shadow-primary/10",
                )}
              >
                <div
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl",
                    meta.iconBg,
                  )}
                >
                  <Icon className={cn("size-5", meta.iconColor)} />
                </div>

                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="font-semibold text-foreground group-hover:text-primary">
                    {b.name}
                  </p>
                  <p className="mt-0.5 text-sm leading-snug text-muted-foreground">
                    {b.city ? `${b.city} · ` : ""}
                    {stats} · {b._count.members} membres
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge variant="secondary">{detailBadge}</Badge>
                    <Badge variant="outline">{b.code}</Badge>
                    <Badge variant="outline">{b.status}</Badge>
                  </div>
                </div>
              </Link>

              <div className="absolute top-3 right-3 z-20">
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex size-9 items-center justify-center rounded-md bg-card text-muted-foreground shadow-sm ring-1 ring-border/60 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Actions pour ${b.name}`}
                  >
                    <MoreHorizontal className="size-5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="z-50 min-w-44">
                    <DropdownMenuItem
                      onClick={() =>
                        router.push(
                          `/admin/organizations/${organizationId}/branches/edit/${b.id}`,
                        )
                      }
                    >
                      <Pencil className="size-4" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setToDelete(b)}
                    >
                      <Trash2 className="size-4" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>

      <ResponsiveDialog
        open={toDelete != null}
        onOpenChange={(open) => {
          if (!open && !pending) setToDelete(null);
        }}
      >
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader className="sm:text-center">
            <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-7 text-destructive" />
            </div>
            <ResponsiveDialogTitle>
              Supprimer « {toDelete?.name} » ?
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription className="text-pretty">
              Cette action est définitive. Les stocks, ventes, séjours et
              paramètres liés à la branche{" "}
              <span className="font-medium text-foreground">
                {toDelete?.code}
              </span>{" "}
              seront supprimés ou détachés. Les trajets d’agence restent dans
              l’organisation sans rattachement.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter className="gap-2 sm:flex-row sm:justify-center">
            <ResponsiveDialogClose>
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                disabled={pending}
              >
                Annuler
              </Button>
            </ResponsiveDialogClose>
            <Button
              type="button"
              variant="destructive"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={confirmDelete}
            >
              <Trash2 className="size-4" />
              {pending ? "Suppression…" : "Oui, supprimer"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}
