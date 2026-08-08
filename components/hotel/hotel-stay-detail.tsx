"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import { formatStayDateFr } from "@/lib/hotel/folio-nights";
import { HOTEL_ROOM_STATUS_LABELS } from "@/lib/hotel/room-status";
import type { StayDetail, StayFormOptions } from "@/lib/hotel/list-stays";
import {
  HOTEL_PAYMENT_METHODS,
  HOTEL_PAYMENT_METHOD_LABELS,
  HOTEL_PAYMENT_STATUS_LABELS,
  type HotelPaymentMethod,
} from "@/lib/hotel/payment-method";
import { recordStayPaymentAction } from "@/lib/hotel/payment-actions";
import {
  HOTEL_STAY_STATUS_BADGE_CLASS,
  HOTEL_STAY_STATUS_LABELS,
} from "@/lib/hotel/stay-status";
import {
  checkInHotelStayAction,
  checkOutHotelStayAction,
} from "@/lib/hotel/stay-actions";

type Props = {
  organizationId: string;
  branchId: string;
  stay: StayDetail;
  formOptions: StayFormOptions;
  canUpdateStay?: boolean;
};

export function HotelStayDetail({
  organizationId,
  branchId,
  stay,
  formOptions,
  canUpdateStay = false,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [roomId, setRoomId] = useState(stay.roomId ?? "");
  const [payMethod, setPayMethod] = useState<HotelPaymentMethod>("CASH");
  const [payAmount, setPayAmount] = useState(
    stay.balanceAmount > 0 ? String(stay.balanceAmount) : "",
  );
  const [payReference, setPayReference] = useState("");

  useEffect(() => {
    setPayAmount(stay.balanceAmount > 0 ? String(stay.balanceAmount) : "");
  }, [stay.balanceAmount]);

  const roomsForType = useMemo(() => {
    const type = formOptions.types.find((t) => t.id === stay.roomTypeId);
    return type?.rooms ?? [];
  }, [formOptions.types, stay.roomTypeId]);

  const readyRooms = roomsForType.filter((r) => r.status === "AVAILABLE");

  function onCheckIn() {
    startTransition(async () => {
      const result = await checkInHotelStayAction({
        organizationId,
        branchId,
        stayId: stay.id,
        roomId: roomId || undefined,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Check-in effectué — chambre Occupée");
      router.refresh();
    });
  }

  function onCheckOut() {
    startTransition(async () => {
      const result = await checkOutHotelStayAction({
        organizationId,
        branchId,
        stayId: stay.id,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Check-out effectué — chambre Libre · Sale");
      router.refresh();
    });
  }

  function onRecordPayment() {
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Montant invalide.");
      return;
    }
    startTransition(async () => {
      const result = await recordStayPaymentAction({
        organizationId,
        branchId,
        stayId: stay.id,
        amount,
        method: payMethod,
        reference: payReference.trim() || undefined,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success("Paiement enregistré");
      setPayReference("");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <Link
          href={hotelRoutes.sejours(organizationId, branchId)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Séjours
        </Link>
        <header className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {stay.guestName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {stay.guestPhone} · {stay.roomTypeName}
              {stay.roomNumber ? ` · chambre ${stay.roomNumber}` : ""}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatStayDateFr(stay.checkInDate)} →{" "}
              {formatStayDateFr(stay.checkOutDate)}
            </p>
          </div>
          <Badge
            className={cn(HOTEL_STAY_STATUS_BADGE_CLASS[stay.status])}
            variant="outline"
          >
            {HOTEL_STAY_STATUS_LABELS[stay.status]}
          </Badge>
        </header>
      </div>

      {stay.status === "BOOKED" && canUpdateStay ? (
        <section className="flex flex-col gap-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Check-in</h2>
          <p className="text-sm text-muted-foreground">
            La chambre doit être Libre · Prête. Les chambres en Libre · Sale ou
            Hors service doivent d’abord être remises en état sur le tableau
            Chambres.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="checkin-room">Chambre</Label>
            <Select
              id="checkin-room"
              value={roomId}
              disabled={pending}
              onChange={(e) => setRoomId(e.target.value)}
            >
              <option value="">Choisir une chambre</option>
              {roomsForType.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}
                  {r.floor ? ` · ét. ${r.floor}` : ""} —{" "}
                  {HOTEL_ROOM_STATUS_LABELS[
                    r.status as keyof typeof HOTEL_ROOM_STATUS_LABELS
                  ] ?? r.status}
                  {r.status !== "AVAILABLE" ? " (indisponible)" : ""}
                </option>
              ))}
            </Select>
          </div>
          {readyRooms.length === 0 ? (
            <p className="text-sm text-warning-foreground">
              Aucune chambre Libre · Prête pour ce type.
            </p>
          ) : null}
          <Button
            onClick={onCheckIn}
            disabled={pending || (!roomId && !stay.roomId)}
          >
            {pending ? "Check-in…" : "Enregistrer l’arrivée"}
          </Button>
        </section>
      ) : null}

      {stay.status === "IN_HOUSE" && canUpdateStay ? (
        <section className="flex flex-col gap-3 rounded-xl border p-4">
          <h2 className="text-sm font-semibold">Check-out</h2>
          <p className="text-sm text-muted-foreground">
            Clôture le séjour et passe la chambre en Libre · Sale.
          </p>
          <Button onClick={onCheckOut} disabled={pending} variant="outline">
            {pending ? "Check-out…" : "Enregistrer le départ"}
          </Button>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <h2 className="text-sm font-semibold">Folio</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            <span>
              Total{" "}
              <span className="font-medium tabular-nums">
                {formatMontantFc(stay.totalAmount)}
              </span>
            </span>
            <span>
              Payé{" "}
              <span className="font-medium tabular-nums text-success">
                {formatMontantFc(stay.paidAmount)}
              </span>
            </span>
            <span>
              Solde{" "}
              <span
                className={cn(
                  "font-medium tabular-nums",
                  stay.balanceAmount > 0
                    ? "text-warning-foreground"
                    : "text-success",
                )}
              >
                {formatMontantFc(stay.balanceAmount)}
              </span>
            </span>
          </div>
        </div>
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Libellé</TableHead>
                <TableHead className="text-right">Montant</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stay.folioLines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={2} className="text-muted-foreground">
                    Aucune ligne
                  </TableCell>
                </TableRow>
              ) : (
                stay.folioLines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell>{line.label}</TableCell>
                    <TableCell className="text-right">
                      {formatMontantFc(line.amount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">
          Tarif / nuit : {formatMontantFc(stay.priceNight)}. Les commandes
          restauration liées au séjour apparaissent ici (lignes « Restauration
          »).
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Paiements</h2>
        {stay.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun paiement enregistré.
          </p>
        ) : (
          <div className="rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Méthode</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stay.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {new Date(p.createdAt).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell>
                      {HOTEL_PAYMENT_METHOD_LABELS[p.method]}
                      {p.reference ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {p.reference}
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {HOTEL_PAYMENT_STATUS_LABELS[p.status]}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMontantFc(p.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {canUpdateStay && stay.balanceAmount > 0 ? (
          <div className="flex flex-col gap-3 rounded-xl border p-4">
            <h3 className="text-sm font-medium">Encaisser le solde</h3>
            <p className="text-xs text-muted-foreground">
              Espèces, Mobile Money ou Carte — sans session de caisse
              obligatoire.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pay-method">Mode de paiement</Label>
                <Select
                  id="pay-method"
                  value={payMethod}
                  disabled={pending}
                  onChange={(e) =>
                    setPayMethod(e.target.value as HotelPaymentMethod)
                  }
                >
                  {HOTEL_PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {HOTEL_PAYMENT_METHOD_LABELS[m]}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="pay-amount">Montant (CDF)</Label>
                <Input
                  id="pay-amount"
                  type="number"
                  min={1}
                  step={1}
                  value={payAmount}
                  disabled={pending}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pay-ref">Référence (optionnel)</Label>
              <Input
                id="pay-ref"
                value={payReference}
                disabled={pending}
                placeholder="Ex. reçu MM"
                onChange={(e) => setPayReference(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => setPayAmount(String(stay.balanceAmount))}
              >
                Solde entier
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={onRecordPayment}
              >
                {pending ? "Enregistrement…" : "Enregistrer le paiement"}
              </Button>
            </div>
          </div>
        ) : null}

        {canUpdateStay && stay.balanceAmount <= 0 && stay.totalAmount > 0 ? (
          <p className="text-sm text-success">Folio soldé.</p>
        ) : null}
      </section>
    </div>
  );
}
