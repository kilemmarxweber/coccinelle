"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BedDouble, Pencil, Plus, Presentation, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createHotelRoomAction,
  updateHotelRoomAction,
  updateRoomStatusAction,
} from "@/lib/hotel/actions";
import {
  formatPrimaryAmount,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";
import { cn } from "@/lib/utils";

const STATUSES = [
  {
    value: "AVAILABLE",
    label: "Libre",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
  {
    value: "OCCUPIED",
    label: "Occupée",
    className: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  {
    value: "CLEANING",
    label: "Ménage",
    className: "bg-muted text-muted-foreground",
  },
  {
    value: "OUT_OF_ORDER",
    label: "HS",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
] as const;

type RoomType = {
  id: string;
  name: string;
  capacity: number;
  seatsStandard?: number | null;
  seatsVip?: number | null;
  priceNight: number;
  description?: string | null;
};

type Room = {
  id: string;
  number: string;
  floor: string | null;
  status: string;
  roomTypeId?: string;
  roomType: RoomType;
};

type FormState = {
  number: string;
  floor: string;
  roomTypeId: string;
  /** "__new__" = créer un type */
  typeMode: "existing" | "new";
  newTypeName: string;
  newTypeCapacity: string;
  newTypeSeatsStandard: string;
  newTypeSeatsVip: string;
  newTypePrice: string;
  status: (typeof STATUSES)[number]["value"];
};

const EMPTY_FORM: FormState = {
  number: "",
  floor: "",
  roomTypeId: "",
  typeMode: "existing",
  newTypeName: "",
  newTypeCapacity: "2",
  newTypeSeatsStandard: "12",
  newTypeSeatsVip: "0",
  newTypePrice: "",
  status: "AVAILABLE",
};

function spaceCopy(kind: "ROOM" | "MEETING") {
  if (kind === "MEETING") {
    return {
      title: "Salles de réunion",
      subtitle: "Types, capacité et disponibilité.",
      add: "Ajouter une salle",
      empty: "Aucune salle dans ce filtre.",
      search: "Rechercher une salle…",
      entity: "salle",
      editTitle: "Modifier la salle",
      createTitle: "Nouvelle salle",
      numberLabel: "Code / n°",
      numberPlaceholder: "Ex. R1, Conf-A",
      typeLabel: "Type de salle",
      typeExisting: "Type existant",
      typeNew: "Nouveau type",
      typeNamePlaceholder: "Ex. Conférence, Boardroom…",
      priceLabel: "Tarif catalogue",
      priceHint: "/créneau (réf.)",
      cardPrefix: "Salle",
      Icon: Presentation,
      iconWrap: "bg-indigo-500/15 text-indigo-600",
      occupiedLabel: "Occupée",
    };
  }
  return {
    title: "Chambres",
    subtitle: "Inventaire par type · statuts ménage / occupation.",
    add: "Ajouter une chambre",
    empty: "Aucune chambre dans ce filtre.",
    search: "Rechercher une chambre…",
    entity: "chambre",
    editTitle: "Modifier la chambre",
    createTitle: "Nouvelle chambre",
    numberLabel: "Numéro",
    numberPlaceholder: "Ex. 101",
    typeLabel: "Type de chambre",
    typeExisting: "Type existant",
    typeNew: "Nouveau type",
    typeNamePlaceholder: "Ex. Standard, Suite…",
    priceLabel: "Tarif / nuit",
    priceHint: "/nuit",
    cardPrefix: "Ch.",
    Icon: BedDouble,
    iconWrap: "bg-sky-500/15 text-sky-600",
    occupiedLabel: "Occupée",
  };
}

export function ChambresClient(props: {
  organizationId: string;
  branchId: string;
  rooms: Room[];
  roomTypes: RoomType[];
  rate?: NormalizedUsdCdfRate | null;
  /** ROOM (défaut) | MEETING */
  spaceKind?: "ROOM" | "MEETING";
}) {
  const spaceKind = props.spaceKind === "MEETING" ? "MEETING" : "ROOM";
  const copy = spaceCopy(spaceKind);
  const SpaceIcon = copy.Icon;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("Tous");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState<FormState>({
    ...EMPTY_FORM,
    newTypeCapacity: spaceKind === "MEETING" ? "12" : "2",
  });

  function fmt(amountUsd: number) {
    return formatPrimaryAmount(amountUsd, props.rate);
  }

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const t of props.roomTypes) names.add(t.name);
    for (const r of props.rooms) names.add(r.roomType.name);
    return ["Tous", ...[...names].sort((a, b) => a.localeCompare(b, "fr"))];
  }, [props.roomTypes, props.rooms]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return props.rooms.filter((room) => {
      if (typeFilter !== "Tous" && room.roomType.name !== typeFilter) {
        return false;
      }
      if (!q) return true;
      return (
        room.number.toLowerCase().includes(q) ||
        room.roomType.name.toLowerCase().includes(q) ||
        (room.floor?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [props.rooms, query, typeFilter]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      roomTypeId: props.roomTypes[0]?.id ?? "",
      typeMode: props.roomTypes.length > 0 ? "existing" : "new",
      newTypeCapacity: spaceKind === "MEETING" ? "12" : "2",
      newTypeSeatsStandard: spaceKind === "MEETING" ? "12" : "0",
      newTypeSeatsVip: spaceKind === "MEETING" ? "0" : "0",
    });
    setDialogOpen(true);
  }

  function openEdit(room: Room) {
    setEditing(room);
    setForm({
      number: room.number,
      floor: room.floor ?? "",
      roomTypeId: room.roomType.id,
      typeMode: "existing",
      newTypeName: "",
      newTypeCapacity: "2",
      newTypeSeatsStandard: "0",
      newTypeSeatsVip: "0",
      newTypePrice: "",
      status:
        (STATUSES.find((s) => s.value === room.status)?.value as
          | FormState["status"]
          | undefined) ?? "AVAILABLE",
    });
    setDialogOpen(true);
  }

  function setStatus(
    roomId: string,
    status: (typeof STATUSES)[number]["value"],
  ) {
    start(async () => {
      try {
        await updateRoomStatusAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          roomId,
          status,
        });
        toast.success("Statut mis à jour");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function save() {
    const number = form.number.trim();
    if (!number) {
      toast.error("Numéro de chambre requis.");
      return;
    }

    start(async () => {
      try {
        if (editing) {
          if (!form.roomTypeId) {
            toast.error("Type requis.");
            return;
          }
          await updateHotelRoomAction({
            organizationId: props.organizationId,
            branchId: props.branchId,
            roomId: editing.id,
            number,
            floor: form.floor,
            roomTypeId: form.roomTypeId,
            spaceKind,
            status: form.status,
          });
          toast.success(
            spaceKind === "MEETING" ? "Salle mise à jour" : "Chambre mise à jour",
          );
        } else if (form.typeMode === "new") {
          const priceNight = Number(form.newTypePrice);
          const seatsStandard =
            spaceKind === "MEETING"
              ? Math.max(0, Math.round(Number(form.newTypeSeatsStandard || 0)))
              : null;
          const seatsVip =
            spaceKind === "MEETING"
              ? Math.max(0, Math.round(Number(form.newTypeSeatsVip || 0)))
              : null;
          const capacity =
            spaceKind === "MEETING" &&
            (seatsStandard != null || seatsVip != null)
              ? (seatsStandard ?? 0) + (seatsVip ?? 0)
              : Math.round(Number(form.newTypeCapacity));
          if (!form.newTypeName.trim()) {
            toast.error("Nom du type requis.");
            return;
          }
          if (!Number.isFinite(priceNight) || priceNight < 0) {
            toast.error("Tarif invalide.");
            return;
          }
          if (!Number.isFinite(capacity) || capacity < 1) {
            toast.error(
              spaceKind === "MEETING"
                ? "Indiquez au moins une place (simple ou VIP)."
                : "Capacité invalide.",
            );
            return;
          }
          await createHotelRoomAction({
            organizationId: props.organizationId,
            branchId: props.branchId,
            number,
            floor: form.floor,
            spaceKind,
            newType: {
              name: form.newTypeName.trim(),
              capacity,
              seatsStandard,
              seatsVip,
              priceNight,
            },
          });
          toast.success(
            spaceKind === "MEETING" ? "Salle créée" : "Chambre créée",
          );
        } else {
          if (!form.roomTypeId) {
            toast.error("Choisissez un type.");
            return;
          }
          await createHotelRoomAction({
            organizationId: props.organizationId,
            branchId: props.branchId,
            number,
            floor: form.floor,
            roomTypeId: form.roomTypeId,
            spaceKind,
          });
          toast.success(
            spaceKind === "MEETING" ? "Salle créée" : "Chambre créée",
          );
        }
        setDialogOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-5 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "flex size-12 items-center justify-center rounded-2xl",
              copy.iconWrap,
            )}
          >
            <SpaceIcon className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
            <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
          </div>
        </div>
        <Button type="button" onClick={openCreate} className="gap-1.5">
          <Plus className="size-4" />
          {copy.add}
        </Button>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={copy.search}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setTypeFilter(cat)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                typeFilter === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80",
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">{copy.empty}</p>
          <Button type="button" className="mt-4" onClick={openCreate}>
            {copy.add}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((room) => {
            const meta =
              STATUSES.find((s) => s.value === room.status) ?? STATUSES[0];
            return (
              <article
                key={room.id}
                className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
              >
                <div
                  className={cn(
                    "relative flex aspect-[4/3] items-center justify-center bg-gradient-to-br via-muted",
                    spaceKind === "MEETING"
                      ? "from-indigo-500/20 to-sky-500/10"
                      : "from-sky-500/20 to-violet-500/10",
                  )}
                >
                  <SpaceIcon className="size-10 text-muted-foreground/70" />
                  <div className="absolute top-2 left-2">
                    <Badge
                      variant="secondary"
                      className="bg-black/55 text-white backdrop-blur-sm"
                    >
                      {room.roomType.name}
                    </Badge>
                  </div>
                  <div className="absolute top-2 right-2">
                    <Badge
                      variant="secondary"
                      className={cn("border-0", meta.className)}
                    >
                      {meta.label}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2 p-3">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {copy.cardPrefix} {room.number}
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        →{" "}
                      </span>
                      <span
                        className={cn(
                          "font-semibold lowercase",
                          meta.className.includes("emerald")
                            ? "text-emerald-700 dark:text-emerald-300"
                            : meta.className.includes("sky")
                              ? "text-sky-700 dark:text-sky-300"
                              : meta.className.includes("rose")
                                ? "text-rose-700 dark:text-rose-300"
                                : "text-muted-foreground",
                        )}
                      >
                        {meta.label.toLowerCase()}
                      </span>
                    </h2>
                    <p className="mt-0.5 text-sm font-medium tabular-nums text-primary">
                      {fmt(room.roomType.priceNight)}
                      {copy.priceHint}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {spaceKind === "MEETING" &&
                      (room.roomType.seatsStandard != null ||
                        room.roomType.seatsVip != null)
                        ? `${room.roomType.seatsStandard ?? 0} simple · ${room.roomType.seatsVip ?? 0} VIP · ${room.roomType.capacity} places`
                        : `${room.roomType.capacity} pers.`}
                      {room.floor ? ` · étage ${room.floor}` : ""}
                    </p>
                  </div>
                  <div className="mt-auto flex flex-col gap-1.5">
                    <div className="flex flex-wrap gap-1">
                      {STATUSES.map((s) => (
                        <Button
                          key={s.value}
                          type="button"
                          size="xs"
                          variant={
                            room.status === s.value ? "default" : "outline"
                          }
                          disabled={pending || room.status === s.value}
                          onClick={() => setStatus(room.id, s.value)}
                        >
                          {s.label}
                        </Button>
                      ))}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      disabled={pending}
                      onClick={() => openEdit(room)}
                    >
                      <Pencil className="size-3.5" />
                      Modifier
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {editing ? copy.editTitle : copy.createTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="room-number">{copy.numberLabel}</Label>
                <Input
                  id="room-number"
                  value={form.number}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, number: e.target.value }))
                  }
                  placeholder={copy.numberPlaceholder}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="room-floor">Étage · optionnel</Label>
                <Input
                  id="room-floor"
                  value={form.floor}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, floor: e.target.value }))
                  }
                  placeholder="Ex. 1"
                />
              </div>
            </div>

            {!editing ? (
              <div className="grid gap-1.5">
                <Label>Type / catégorie</Label>
                <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
                  <button
                    type="button"
                    disabled={props.roomTypes.length === 0}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        typeMode: "existing",
                        roomTypeId: f.roomTypeId || props.roomTypes[0]?.id || "",
                      }))
                    }
                    className={cn(
                      "rounded-md px-2 py-2 text-xs font-semibold transition",
                      form.typeMode === "existing"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted",
                      props.roomTypes.length === 0 && "opacity-50",
                    )}
                  >
                    {copy.typeExisting}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, typeMode: "new" }))
                    }
                    className={cn(
                      "rounded-md px-2 py-2 text-xs font-semibold transition",
                      form.typeMode === "new"
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {copy.typeNew}
                  </button>
                </div>
              </div>
            ) : null}

            {editing || form.typeMode === "existing" ? (
              <div className="grid gap-1.5">
                <Label htmlFor="room-type">{copy.typeLabel}</Label>
                <Select
                  id="room-type"
                  value={form.roomTypeId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, roomTypeId: e.target.value }))
                  }
                >
                  <option value="">Choisir…</option>
                  {props.roomTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} · {fmt(t.priceNight)}
                      {copy.priceHint} ·{" "}
                      {spaceKind === "MEETING" &&
                      (t.seatsStandard != null || t.seatsVip != null)
                        ? `${t.seatsStandard ?? 0} simple / ${t.seatsVip ?? 0} VIP`
                        : `${t.capacity} pers.`}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <div className="grid gap-3 rounded-xl border border-border bg-muted/20 p-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="new-type-name">Nom du type</Label>
                  <Input
                    id="new-type-name"
                    value={form.newTypeName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, newTypeName: e.target.value }))
                    }
                    placeholder={copy.typeNamePlaceholder}
                  />
                </div>
                {spaceKind === "MEETING" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor="new-type-seats-std">Places simples</Label>
                      <Input
                        id="new-type-seats-std"
                        type="number"
                        min={0}
                        step={1}
                        value={form.newTypeSeatsStandard}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            newTypeSeatsStandard: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor="new-type-seats-vip">Places VIP</Label>
                      <Input
                        id="new-type-seats-vip"
                        type="number"
                        min={0}
                        step={1}
                        value={form.newTypeSeatsVip}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            newTypeSeatsVip: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-1.5">
                    <Label htmlFor="new-type-capacity">Capacité</Label>
                    <Input
                      id="new-type-capacity"
                      type="number"
                      min={1}
                      step={1}
                      value={form.newTypeCapacity}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          newTypeCapacity: e.target.value,
                        }))
                      }
                    />
                  </div>
                )}
                <div className="grid gap-1.5">
                  <Label htmlFor="new-type-price">{copy.priceLabel}</Label>
                  <Input
                    id="new-type-price"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.newTypePrice}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        newTypePrice: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                </div>
                {spaceKind === "MEETING" ? (
                  <p className="text-[11px] text-muted-foreground">
                    Capacité totale = simples + VIP (
                    {Math.max(
                      0,
                      Math.round(Number(form.newTypeSeatsStandard || 0)),
                    ) +
                      Math.max(
                        0,
                        Math.round(Number(form.newTypeSeatsVip || 0)),
                      )}{" "}
                    places)
                  </p>
                ) : null}
              </div>
            )}

            {editing ? (
              <div className="grid gap-1.5">
                <Label htmlFor="room-status">Statut</Label>
                <Select
                  id="room-status"
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as FormState["status"],
                    }))
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" disabled={pending} onClick={save}>
              {editing ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
