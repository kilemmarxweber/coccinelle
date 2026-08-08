"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
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
import type { FnbFormOptions } from "@/lib/hotel/list-fnb";
import type { TableReservationView } from "@/lib/hotel/list-table-reservations";
import {
  cancelAdminTableReservationAction,
  createAdminTableReservationAction,
  getAdminAvailableTablesAction,
} from "@/lib/hotel/table-reservation-actions";
import {
  HOTEL_TABLE_RESERVATION_STATUS_BADGE_CLASS,
  HOTEL_TABLE_RESERVATION_STATUS_LABELS,
} from "@/lib/hotel/table-reservation-status";
import { formatMontantFc } from "@/lib/reservation/labels";
import { cn } from "@/lib/utils";

type Props = {
  organizationId: string;
  branchId: string;
  reservations: TableReservationView[];
  formOptions: FnbFormOptions;
  canCreate: boolean;
  canUpdate: boolean;
};

function toLocalInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultStartsAt(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return toLocalInputValue(d);
}

export function HotelTableReservationsAdmin({
  organizationId,
  branchId,
  reservations,
  formOptions,
  canCreate,
  canUpdate,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function cancel(reservationId: string) {
    startTransition(async () => {
      const result = await cancelAdminTableReservationAction({
        organizationId,
        branchId,
        reservationId,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Réservation annulée");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Réservations de table à venir (en ligne ou téléphone). Sur place sans
          réservation : enregistrement via Commandes.
        </p>
        {canCreate ? (
          <CreateTableReservationDialog
            organizationId={organizationId}
            branchId={branchId}
            formOptions={formOptions}
          />
        ) : null}
      </div>

      {reservations.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16 text-center">
          <CalendarClock className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Aucune réservation à venir</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Les réservations client en ligne et celles créées ici apparaîtront
              dans cette liste.
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quand</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Table</TableHead>
                <TableHead>Couverts</TableHead>
                <TableHead>Plats</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reservations.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {new Date(row.startsAt).toLocaleString("fr-FR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{row.guestName}</div>
                    <div className="text-xs text-muted-foreground">
                      {row.guestPhone}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.tableNumber ? `T${row.tableNumber}` : "—"}
                  </TableCell>
                  <TableCell className="tabular-nums">{row.covers}</TableCell>
                  <TableCell>
                    {row.foodLines.length === 0 ? (
                      <span className="text-muted-foreground">Table seule</span>
                    ) : (
                      <div className="text-sm">
                        <p>
                          {row.foodLines.length} ligne
                          {row.foodLines.length > 1 ? "s" : ""}
                        </p>
                        <p className="tabular-nums text-muted-foreground">
                          {formatMontantFc(row.foodTotal)}
                        </p>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        HOTEL_TABLE_RESERVATION_STATUS_BADGE_CLASS[row.status],
                      )}
                    >
                      {HOTEL_TABLE_RESERVATION_STATUS_LABELS[row.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {canUpdate && row.status === "CONFIRMED" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => cancel(row.id)}
                      >
                        Annuler
                      </Button>
                    ) : null}
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

function CreateTableReservationDialog({
  organizationId,
  branchId,
  formOptions,
}: {
  organizationId: string;
  branchId: string;
  formOptions: FnbFormOptions;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [covers, setCovers] = useState(2);
  const [guestPrenom, setGuestPrenom] = useState("");
  const [guestNom, setGuestNom] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [tableId, setTableId] = useState("");
  const [tables, setTables] = useState<
    Array<{ id: string; number: string; capacity: number }>
  >([]);
  const [menuItemId, setMenuItemId] = useState(
    formOptions.activeItems[0]?.id ?? "",
  );
  const [quantity, setQuantity] = useState(1);
  const [lines, setLines] = useState<
    Array<{ menuItemId: string; name: string; quantity: number }>
  >([]);

  function refreshTables() {
    startTransition(async () => {
      const result = await getAdminAvailableTablesAction({
        organizationId,
        branchId,
        startsAt: new Date(startsAt),
        covers,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      setTables(result.data);
      setTableId("");
    });
  }

  function addLine() {
    const item = formOptions.activeItems.find((i) => i.id === menuItemId);
    if (!item) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.menuItemId === item.id);
      if (existing) {
        return prev.map((l) =>
          l.menuItemId === item.id
            ? { ...l, quantity: l.quantity + quantity }
            : l,
        );
      }
      return [
        ...prev,
        { menuItemId: item.id, name: item.name, quantity },
      ];
    });
  }

  function onSubmit() {
    startTransition(async () => {
      const result = await createAdminTableReservationAction({
        organizationId,
        branchId,
        guestPrenom,
        guestNom,
        guestPhone,
        startsAt: new Date(startsAt),
        covers,
        tableId: tableId || "",
        notes,
        lines: lines.map((l) => ({
          menuItemId: l.menuItemId,
          quantity: l.quantity,
        })),
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Réservation créée");
      setOpen(false);
      setGuestPrenom("");
      setGuestNom("");
      setGuestPhone("");
      setNotes("");
      setLines([]);
      setStartsAt(defaultStartsAt());
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" size="sm" />}
      >
        <Plus className="size-4" aria-hidden />
        Nouvelle réservation
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Réserver une table</DialogTitle>
          <DialogDescription>
            Pour un appel téléphone ou une demande à la réception. Optionnel :
            précommande pour la cuisine.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-tr-starts">Date et heure</Label>
              <Input
                id="admin-tr-starts"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-tr-covers">Couverts</Label>
              <Input
                id="admin-tr-covers"
                type="number"
                min={1}
                max={50}
                value={covers}
                onChange={(e) => setCovers(Number(e.target.value) || 1)}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={refreshTables}
          >
            Charger les tables libres
          </Button>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-tr-table">Table</Label>
            <Select
              id="admin-tr-table"
              value={tableId}
              onChange={(e) => setTableId(e.target.value)}
            >
              <option value="">Attribution automatique</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  Table {t.number} · {t.capacity} places
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-tr-prenom">Prénom</Label>
              <Input
                id="admin-tr-prenom"
                value={guestPrenom}
                onChange={(e) => setGuestPrenom(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="admin-tr-nom">Nom</Label>
              <Input
                id="admin-tr-nom"
                value={guestNom}
                onChange={(e) => setGuestNom(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-tr-phone">Téléphone</Label>
            <Input
              id="admin-tr-phone"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="admin-tr-notes">Note</Label>
            <Textarea
              id="admin-tr-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          {formOptions.activeItems.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-lg border p-3">
              <p className="text-sm font-medium">Précommande (optionnel)</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[10rem] flex-1 flex flex-col gap-1.5">
                  <Label htmlFor="admin-tr-item">Plat</Label>
                  <Select
                    id="admin-tr-item"
                    value={menuItemId}
                    onChange={(e) => setMenuItemId(e.target.value)}
                  >
                    {formOptions.activeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="w-20 flex flex-col gap-1.5">
                  <Label htmlFor="admin-tr-qty">Qté</Label>
                  <Input
                    id="admin-tr-qty"
                    type="number"
                    min={1}
                    max={99}
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value) || 1)}
                  />
                </div>
                <Button type="button" size="sm" variant="outline" onClick={addLine}>
                  Ajouter
                </Button>
              </div>
              {lines.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {lines.map((line) => (
                    <li key={line.menuItemId}>
                      {line.quantity}× {line.name}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => setOpen(false)}
          >
            Fermer
          </Button>
          <Button type="button" disabled={pending} onClick={onSubmit}>
            {pending ? "Enregistrement…" : "Confirmer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
