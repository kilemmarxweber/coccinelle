"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BedDouble, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatMontantFc } from "@/lib/reservation/labels";
import type {
  RoomBoardData,
  RoomBoardRoom,
  RoomBoardType,
} from "@/lib/hotel/list-rooms-board";
import {
  HOTEL_ROOM_STATUSES,
  HOTEL_ROOM_STATUS_BADGE_CLASS,
  HOTEL_ROOM_STATUS_LABELS,
  type HotelRoomStatusValue,
} from "@/lib/hotel/room-status";
import {
  createHotelRoomAction,
  createHotelRoomTypeAction,
  updateHotelRoomAction,
  updateHotelRoomStatusAction,
  updateHotelRoomTypeAction,
} from "@/lib/hotel/room-actions";

type Props = {
  organizationId: string;
  branchId: string;
  initial: RoomBoardData;
  canManageInventory?: boolean;
  canUpdateStatus?: boolean;
};

type TransitionStart = (fn: () => void) => void;

function floorKey(floor: string | null): string {
  return floor?.trim() ? floor.trim() : "—";
}

export function HotelRoomBoard({
  organizationId,
  branchId,
  initial,
  canManageInventory = false,
  canUpdateStatus = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [floorFilter, setFloorFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return initial.rooms.filter((room) => {
      if (floorFilter !== "all" && floorKey(room.floor) !== floorFilter) {
        return false;
      }
      if (typeFilter !== "all" && room.roomTypeId !== typeFilter) {
        return false;
      }
      if (statusFilter !== "all" && room.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [initial.rooms, floorFilter, typeFilter, statusFilter]);

  const byFloor = useMemo(() => {
    const map = new Map<string, RoomBoardRoom[]>();
    for (const room of filtered) {
      const key = floorKey(room.floor);
      const list = map.get(key) ?? [];
      list.push(room);
      map.set(key, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b, "fr", { numeric: true }),
    );
  }, [filtered]);

  const { kpis } = initial;

  function onStatusChange(roomId: string, status: HotelRoomStatusValue) {
    startTransition(async () => {
      const result = await updateHotelRoomStatusAction({
        organizationId,
        branchId,
        roomId,
        status,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Statut mis à jour");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chambres</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tableau d’occupation
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManageInventory ? (
            <>
              <CreateRoomTypeDialog
                organizationId={organizationId}
                branchId={branchId}
                pending={pending}
                startTransition={startTransition}
                onDone={() => router.refresh()}
              />
              <CreateRoomDialog
                organizationId={organizationId}
                branchId={branchId}
                types={initial.types}
                pending={pending}
                startTransition={startTransition}
                onDone={() => router.refresh()}
              />
            </>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Total" value={String(kpis.total)} />
        <KpiCard label="Libres prêtes" value={String(kpis.ready)} accent="success" />
        <KpiCard label="Libres sales" value={String(kpis.dirty)} accent="warning" />
        <KpiCard label="Occupées" value={String(kpis.occupied)} accent="primary" />
        <KpiCard label="Hors service" value={String(kpis.outOfOrder)} />
        <KpiCard label="Occupation" value={`${kpis.occupancyPercent} %`} />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-end">
        <FilterField label="Étage">
          <Select
            value={floorFilter}
            onChange={(e) => setFloorFilter(e.target.value)}
            aria-label="Filtrer par étage"
          >
            <option value="all">Tous</option>
            {initial.floors.map((f) => (
              <option key={f} value={f}>
                {f === "—" ? "Sans étage" : `Étage ${f}`}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Type">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filtrer par type"
          >
            <option value="all">Tous</option>
            {initial.types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </FilterField>
        <FilterField label="Statut">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filtrer par statut"
          >
            <option value="all">Tous</option>
            {HOTEL_ROOM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {HOTEL_ROOM_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </FilterField>
      </div>

      {initial.rooms.length === 0 ? (
        <EmptyBoard />
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Aucune chambre ne correspond aux filtres.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {byFloor.map(([floor, rooms]) => (
            <section key={floor} className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-muted-foreground">
                {floor === "—" ? "Sans étage" : `Étage ${floor}`}
                <span className="ml-2 font-normal">({rooms.length})</span>
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {rooms.map((room) => (
                  <RoomTile
                    key={room.id}
                    room={room}
                    types={initial.types}
                    organizationId={organizationId}
                    branchId={branchId}
                    disabled={pending}
                    startTransition={startTransition}
                    onStatusChange={onStatusChange}
                    onDone={() => router.refresh()}
                    canManageInventory={canManageInventory}
                    canUpdateStatus={canUpdateStatus}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <section className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Types de chambres</h2>
          {initial.types.length === 0 ? (
            <span className="text-xs text-muted-foreground">Aucun type</span>
          ) : null}
        </div>
        {initial.types.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Créez un type pour pouvoir ajouter des chambres.
          </p>
        ) : (
          <ul className="mt-3 divide-y">
            {initial.types.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
              >
                <span>
                  <span className="font-medium">{t.name}</span>
                  <span className="ml-2 text-muted-foreground">
                    {t.capacity} pers. · {t.roomCount} ch.
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-muted-foreground">
                    {formatMontantFc(t.priceNight)} / nuit
                  </span>
                  {canManageInventory ? (
                    <EditRoomTypeDialog
                      organizationId={organizationId}
                      branchId={branchId}
                      roomType={t}
                      pending={pending}
                      startTransition={startTransition}
                      onDone={() => router.refresh()}
                    />
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "success" | "warning" | "primary";
}) {
  return (
    <div className="rounded-xl border bg-card px-3 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-semibold tabular-nums tracking-tight",
          accent === "success" && "text-emerald-700 dark:text-emerald-400",
          accent === "warning" && "text-amber-700 dark:text-amber-400",
          accent === "primary" && "text-primary",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-35 flex-1 flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function RoomTile({
  room,
  types,
  organizationId,
  branchId,
  disabled,
  startTransition,
  onStatusChange,
  onDone,
  canManageInventory,
  canUpdateStatus,
}: {
  room: RoomBoardRoom;
  types: RoomBoardType[];
  organizationId: string;
  branchId: string;
  disabled: boolean;
  startTransition: TransitionStart;
  onStatusChange: (roomId: string, status: HotelRoomStatusValue) => void;
  onDone: () => void;
  canManageInventory: boolean;
  canUpdateStatus: boolean;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold tracking-tight">{room.number}</p>
          <p className="text-xs text-muted-foreground">{room.roomTypeName}</p>
          {room.guestName ? (
            <p className="mt-1 text-xs font-medium text-foreground/80">
              {room.guestName}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {canManageInventory ? (
            <EditRoomDialog
              organizationId={organizationId}
              branchId={branchId}
              room={room}
              types={types}
              pending={disabled}
              startTransition={startTransition}
              onDone={onDone}
            />
          ) : null}
          <Badge
            className={cn(HOTEL_ROOM_STATUS_BADGE_CLASS[room.status])}
            variant="outline"
          >
            {HOTEL_ROOM_STATUS_LABELS[room.status]}
          </Badge>
        </div>
      </div>
      {canUpdateStatus ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`status-${room.id}`} className="text-xs text-muted-foreground">
            Changer le statut
          </Label>
          <Select
            id={`status-${room.id}`}
            value={room.status}
            disabled={disabled}
            onChange={(e) =>
              onStatusChange(room.id, e.target.value as HotelRoomStatusValue)
            }
          >
            {HOTEL_ROOM_STATUSES.map((s) => (
              <option key={s} value={s}>
                {HOTEL_ROOM_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
    </article>
  );
}

function EmptyBoard() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <BedDouble className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">Aucune chambre</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Créez un type de chambre puis ajoutez des numéros pour alimenter le
          tableau d’occupation.
        </p>
      </div>
    </div>
  );
}

function CreateRoomTypeDialog({
  organizationId,
  branchId,
  pending,
  startTransition,
  onDone,
}: {
  organizationId: string;
  branchId: string;
  pending: boolean;
  startTransition: TransitionStart;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("2");
  const [priceNight, setPriceNight] = useState("50000");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createHotelRoomTypeAction({
        organizationId,
        branchId,
        name,
        description: description || undefined,
        capacity: Number(capacity),
        priceNight: Number(priceNight),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Type de chambre créé");
      setOpen(false);
      setName("");
      setDescription("");
      setCapacity("2");
      setPriceNight("50000");
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button variant="outline" size="sm" disabled={pending} />}
      >
        <Plus className="size-4" />
        Type
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nouveau type de chambre</DialogTitle>
            <DialogDescription>
              Nom, capacité et tarif nuit (CDF).
            </DialogDescription>
          </DialogHeader>
          <RoomTypeFields
            name={name}
            description={description}
            capacity={capacity}
            priceNight={priceNight}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onCapacityChange={setCapacity}
            onPriceNightChange={setPriceNight}
            idPrefix="create-type"
          />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditRoomTypeDialog({
  organizationId,
  branchId,
  roomType,
  pending,
  startTransition,
  onDone,
}: {
  organizationId: string;
  branchId: string;
  roomType: RoomBoardType;
  pending: boolean;
  startTransition: TransitionStart;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(roomType.name);
  const [description, setDescription] = useState(roomType.description ?? "");
  const [capacity, setCapacity] = useState(String(roomType.capacity));
  const [priceNight, setPriceNight] = useState(String(roomType.priceNight));

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setName(roomType.name);
      setDescription(roomType.description ?? "");
      setCapacity(String(roomType.capacity));
      setPriceNight(String(roomType.priceNight));
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateHotelRoomTypeAction({
        organizationId,
        branchId,
        roomTypeId: roomType.id,
        name,
        description: description || undefined,
        capacity: Number(capacity),
        priceNight: Number(priceNight),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Type mis à jour");
      setOpen(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="icon-sm" disabled={pending} aria-label="Modifier le type" />
        }
      >
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Modifier le type</DialogTitle>
            <DialogDescription>
              Tarif affiché en CDF.
            </DialogDescription>
          </DialogHeader>
          <RoomTypeFields
            name={name}
            description={description}
            capacity={capacity}
            priceNight={priceNight}
            onNameChange={setName}
            onDescriptionChange={setDescription}
            onCapacityChange={setCapacity}
            onPriceNightChange={setPriceNight}
            idPrefix={`edit-type-${roomType.id}`}
          />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoomTypeFields({
  name,
  description,
  capacity,
  priceNight,
  onNameChange,
  onDescriptionChange,
  onCapacityChange,
  onPriceNightChange,
  idPrefix,
}: {
  name: string;
  description: string;
  capacity: string;
  priceNight: string;
  onNameChange: (v: string) => void;
  onDescriptionChange: (v: string) => void;
  onCapacityChange: (v: string) => void;
  onPriceNightChange: (v: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-name`}>Nom</Label>
        <Input
          id={`${idPrefix}-name`}
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-desc`}>Description</Label>
        <Input
          id={`${idPrefix}-desc`}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-cap`}>Capacité</Label>
          <Input
            id={`${idPrefix}-cap`}
            type="number"
            min={1}
            value={capacity}
            onChange={(e) => onCapacityChange(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-price`}>Prix / nuit (CDF)</Label>
          <Input
            id={`${idPrefix}-price`}
            type="number"
            min={0}
            value={priceNight}
            onChange={(e) => onPriceNightChange(e.target.value)}
            required
          />
        </div>
      </div>
    </div>
  );
}

function CreateRoomDialog({
  organizationId,
  branchId,
  types,
  pending,
  startTransition,
  onDone,
}: {
  organizationId: string;
  branchId: string;
  types: RoomBoardData["types"];
  pending: boolean;
  startTransition: TransitionStart;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [roomTypeId, setRoomTypeId] = useState(types[0]?.id ?? "");
  const [number, setNumber] = useState("");
  const [floor, setFloor] = useState("");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setRoomTypeId(types[0]?.id ?? "");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!roomTypeId) {
      toast.error("Créez d’abord un type de chambre.");
      return;
    }
    startTransition(async () => {
      const result = await createHotelRoomAction({
        organizationId,
        branchId,
        roomTypeId,
        number,
        floor: floor || undefined,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Chambre créée");
      setOpen(false);
      setNumber("");
      setFloor("");
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={<Button size="sm" disabled={pending || types.length === 0} />}
      >
        <Plus className="size-4" />
        Chambre
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nouvelle chambre</DialogTitle>
            <DialogDescription>
              Numéro, étage et type — statut initial Libre · Prête.
            </DialogDescription>
          </DialogHeader>
          <RoomFields
            types={types}
            roomTypeId={roomTypeId}
            number={number}
            floor={floor}
            onRoomTypeIdChange={setRoomTypeId}
            onNumberChange={setNumber}
            onFloorChange={setFloor}
            idPrefix="create-room"
          />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditRoomDialog({
  organizationId,
  branchId,
  room,
  types,
  pending,
  startTransition,
  onDone,
}: {
  organizationId: string;
  branchId: string;
  room: RoomBoardRoom;
  types: RoomBoardType[];
  pending: boolean;
  startTransition: TransitionStart;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [roomTypeId, setRoomTypeId] = useState(room.roomTypeId);
  const [number, setNumber] = useState(room.number);
  const [floor, setFloor] = useState(room.floor ?? "");

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setRoomTypeId(room.roomTypeId);
      setNumber(room.number);
      setFloor(room.floor ?? "");
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await updateHotelRoomAction({
        organizationId,
        branchId,
        roomId: room.id,
        roomTypeId,
        number,
        floor: floor || undefined,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Chambre mise à jour");
      setOpen(false);
      onDone();
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label="Modifier la chambre"
          />
        }
      >
        <Pencil className="size-3.5" />
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Modifier la chambre</DialogTitle>
            <DialogDescription>
              Numéro, étage et type.
            </DialogDescription>
          </DialogHeader>
          <RoomFields
            types={types}
            roomTypeId={roomTypeId}
            number={number}
            floor={floor}
            onRoomTypeIdChange={setRoomTypeId}
            onNumberChange={setNumber}
            onFloorChange={setFloor}
            idPrefix={`edit-room-${room.id}`}
          />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RoomFields({
  types,
  roomTypeId,
  number,
  floor,
  onRoomTypeIdChange,
  onNumberChange,
  onFloorChange,
  idPrefix,
}: {
  types: RoomBoardType[];
  roomTypeId: string;
  number: string;
  floor: string;
  onRoomTypeIdChange: (v: string) => void;
  onNumberChange: (v: string) => void;
  onFloorChange: (v: string) => void;
  idPrefix: string;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <Select
          id={`${idPrefix}-type`}
          value={roomTypeId}
          onChange={(e) => onRoomTypeIdChange(e.target.value)}
          required
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-number`}>Numéro</Label>
          <Input
            id={`${idPrefix}-number`}
            value={number}
            onChange={(e) => onNumberChange(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`${idPrefix}-floor`}>Étage</Label>
          <Input
            id={`${idPrefix}-floor`}
            value={floor}
            onChange={(e) => onFloorChange(e.target.value)}
            placeholder="1"
          />
        </div>
      </div>
    </div>
  );
}
