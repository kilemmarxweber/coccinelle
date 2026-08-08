"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { clientHotelRoutes } from "@/lib/branch/paths";
import type { TableReservationView } from "@/lib/hotel/list-table-reservations";
import {
  HOTEL_TABLE_RESERVATION_STATUS_BADGE_CLASS,
  HOTEL_TABLE_RESERVATION_STATUS_LABELS,
} from "@/lib/hotel/table-reservation-status";
import { formatMontantFc } from "@/lib/reservation/labels";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type Props = {
  orgSlug: string;
  hotelName: string;
  reservation: TableReservationView;
};

export function HotelTableReservationConfirmation({
  orgSlug,
  hotelName,
  reservation,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-confirm]", {
        opacity: 0,
        y: 14,
        duration: 0.45,
        stagger: 0.08,
        ease: "power2.out",
      });
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-6 py-2">
      <header className="flex flex-col gap-2">
        <p data-confirm className="text-sm text-muted-foreground">
          {hotelName}
        </p>
        <h1
          data-confirm
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Table réservée
        </h1>
        <Badge
          data-confirm
          variant="outline"
          className={cn(
            "w-fit",
            HOTEL_TABLE_RESERVATION_STATUS_BADGE_CLASS[reservation.status],
          )}
        >
          {HOTEL_TABLE_RESERVATION_STATUS_LABELS[reservation.status]}
        </Badge>
      </header>

      <section
        data-confirm
        className="flex flex-col gap-3 rounded-2xl border bg-card/50 p-5 text-sm"
      >
        <p className="text-base font-medium">{reservation.guestName}</p>
        <p>
          {new Date(reservation.startsAt).toLocaleString("fr-FR", {
            dateStyle: "full",
            timeStyle: "short",
          })}
        </p>
        <p className="text-muted-foreground">
          {reservation.covers} couvert{reservation.covers > 1 ? "s" : ""}
          {reservation.tableNumber
            ? ` · table ${reservation.tableNumber}`
            : ""}
        </p>
        <p className="text-muted-foreground">Tél. {reservation.guestPhone}</p>
        {reservation.notes ? (
          <p className="text-muted-foreground">Note : {reservation.notes}</p>
        ) : null}
      </section>

      {reservation.foodLines.length > 0 ? (
        <section
          data-confirm
          className="flex flex-col gap-3 rounded-2xl border p-5"
        >
          <h2 className="font-semibold">Précommande</h2>
          <ul className="space-y-1 text-sm">
            {reservation.foodLines.map((line) => (
              <li key={line.id} className="flex justify-between gap-2">
                <span>
                  {line.quantity}× {line.name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {formatMontantFc(line.unitPrice * line.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <p className="border-t pt-2 text-sm font-medium tabular-nums">
            Total {formatMontantFc(reservation.foodTotal)}
          </p>
          <p className="text-xs text-muted-foreground">
            La cuisine voit cette commande dans la file.
          </p>
        </section>
      ) : null}

      <div data-confirm className="flex flex-col gap-2 sm:flex-row">
        <Button
          size="lg"
          className="w-full sm:w-auto"
          render={<Link href={clientHotelRoutes.root(orgSlug)} />}
        >
          Retour à l’hôtel
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-auto"
          render={<Link href={clientHotelRoutes.table(orgSlug)} />}
        >
          Nouvelle réservation
        </Button>
      </div>
    </div>
  );
}
