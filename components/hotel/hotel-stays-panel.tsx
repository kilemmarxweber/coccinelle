"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BedDouble, Plus } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { hotelRoutes } from "@/lib/branch/paths";
import { formatMontantFc } from "@/lib/reservation/labels";
import {
  addCalendarDaysInput,
  formatStayDateFr,
  todayDateOnlyInput,
} from "@/lib/hotel/folio-nights";
import { HOTEL_ROOM_STATUS_LABELS } from "@/lib/hotel/room-status";
import type { StayFormOptions, StayListItem } from "@/lib/hotel/list-stays";
import {
  HOTEL_STAY_STATUS_BADGE_CLASS,
  HOTEL_STAY_STATUS_LABELS,
  type StayListFilter,
} from "@/lib/hotel/stay-status";
import { createHotelStayAction } from "@/lib/hotel/stay-actions";

type Props = {
  organizationId: string;
  branchId: string;
  filter: StayListFilter;
  stays: StayListItem[];
  formOptions: StayFormOptions;
  canCreateStay?: boolean;
};

const FILTERS: Array<{ id: StayListFilter; label: string }> = [
  { id: "upcoming", label: "À venir" },
  { id: "in-house", label: "En maison" },
  { id: "checked-out", label: "Partis" },
];

export function HotelStaysPanel({
  organizationId,
  branchId,
  filter,
  stays,
  formOptions,
  canCreateStay = false,
}: Props) {
  const base = hotelRoutes.sejours(organizationId, branchId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Séjours</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Réservations, check-in / check-out
          </p>
        </div>
        {canCreateStay ? (
          <CreateStayDialog
            organizationId={organizationId}
            branchId={branchId}
            formOptions={formOptions}
          />
        ) : null}
      </header>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.id}
            href={`${base}?filter=${f.id}`}
            className={cn(
              "inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors",
              filter === f.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {stays.length === 0 ? (
        <EmptyStays filter={filter} />
      ) : (
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Chambre</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stays.map((stay) => (
                <TableRow key={stay.id}>
                  <TableCell>
                    <Link
                      href={hotelRoutes.sejour(organizationId, branchId, stay.id)}
                      className="font-medium hover:underline"
                    >
                      {stay.guestName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{stay.guestPhone}</p>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatStayDateFr(stay.checkInDate)} →{" "}
                    {formatStayDateFr(stay.checkOutDate)}
                  </TableCell>
                  <TableCell className="text-sm">
                    <span>{stay.roomTypeName}</span>
                    {stay.roomNumber ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {stay.roomNumber}
                      </span>
                    ) : (
                      <span className="text-muted-foreground"> · non assignée</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={cn(HOTEL_STAY_STATUS_BADGE_CLASS[stay.status])}
                      variant="outline"
                    >
                      {HOTEL_STAY_STATUS_LABELS[stay.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {formatMontantFc(stay.totalAmount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function EmptyStays({ filter }: { filter: StayListFilter }) {
  const copy =
    filter === "upcoming"
      ? "Aucun séjour à venir. Créez une réservation ou un walk-in."
      : filter === "in-house"
        ? "Aucun client en maison pour le moment."
        : "Aucun séjour parti dans cette liste.";
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
      <BedDouble className="size-8 text-muted-foreground" />
      <div>
        <p className="font-medium">Aucun séjour</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{copy}</p>
      </div>
    </div>
  );
}

function CreateStayDialog({
  organizationId,
  branchId,
  formOptions,
}: {
  organizationId: string;
  branchId: string;
  formOptions: StayFormOptions;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [guestPrenom, setGuestPrenom] = useState("");
  const [guestNom, setGuestNom] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [roomTypeId, setRoomTypeId] = useState(formOptions.types[0]?.id ?? "");
  const [roomId, setRoomId] = useState("");
  const [checkInDate, setCheckInDate] = useState(todayDateOnlyInput);
  const [checkOutDate, setCheckOutDate] = useState(() =>
    addCalendarDaysInput(todayDateOnlyInput(), 1),
  );

  const selectedType = useMemo(
    () => formOptions.types.find((t) => t.id === roomTypeId),
    [formOptions.types, roomTypeId],
  );

  const roomsForType = selectedType?.rooms ?? [];

  function resetForm() {
    setGuestPrenom("");
    setGuestNom("");
    setGuestPhone("");
    setRoomTypeId(formOptions.types[0]?.id ?? "");
    setRoomId("");
    const inDate = todayDateOnlyInput();
    setCheckInDate(inDate);
    setCheckOutDate(addCalendarDaysInput(inDate, 1));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createHotelStayAction({
        organizationId,
        branchId,
        guestPrenom,
        guestNom,
        guestPhone,
        roomTypeId,
        roomId: roomId || undefined,
        checkInDate,
        checkOutDate,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Séjour créé");
      setOpen(false);
      resetForm();
      router.push(hotelRoutes.sejour(organizationId, branchId, result.data.id));
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button disabled={formOptions.types.length === 0} />
        }
      >
        <Plus className="size-4" />
        Nouveau séjour
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Nouveau séjour</DialogTitle>
            <DialogDescription>
              Identité client, dates et type de chambre. Prix / nuit repris du
              type (CDF).
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stay-prenom">Prénom</Label>
              <Input
                id="stay-prenom"
                value={guestPrenom}
                onChange={(e) => setGuestPrenom(e.target.value)}
                required
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stay-nom">Nom</Label>
              <Input
                id="stay-nom"
                value={guestNom}
                onChange={(e) => setGuestNom(e.target.value)}
                required
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="stay-phone">Téléphone</Label>
              <Input
                id="stay-phone"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                required
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stay-in">Arrivée</Label>
              <Input
                id="stay-in"
                type="date"
                value={checkInDate}
                onChange={(e) => setCheckInDate(e.target.value)}
                required
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="stay-out">Départ</Label>
              <Input
                id="stay-out"
                type="date"
                value={checkOutDate}
                onChange={(e) => setCheckOutDate(e.target.value)}
                required
                disabled={pending}
              />
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="stay-type">Type de chambre</Label>
              <Select
                id="stay-type"
                value={roomTypeId}
                disabled={pending || formOptions.types.length === 0}
                onChange={(e) => {
                  setRoomTypeId(e.target.value);
                  setRoomId("");
                }}
              >
                {formOptions.types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} — {formatMontantFc(t.priceNight)} / nuit
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <Label htmlFor="stay-room">Chambre (optionnel)</Label>
              <Select
                id="stay-room"
                value={roomId}
                disabled={pending || roomsForType.length === 0}
                onChange={(e) => setRoomId(e.target.value)}
              >
                <option value="">Assigner plus tard</option>
                {roomsForType.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number}
                    {r.floor ? ` · ét. ${r.floor}` : ""} —{" "}
                    {HOTEL_ROOM_STATUS_LABELS[
                      r.status as keyof typeof HOTEL_ROOM_STATUS_LABELS
                    ] ?? r.status}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="submit" disabled={pending || !roomTypeId}>
              {pending ? "Création…" : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
