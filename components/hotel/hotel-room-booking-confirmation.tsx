"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clientHotelRoutes } from "@/lib/branch/paths";
import { formatStayDateFr } from "@/lib/hotel/folio-nights";
import {
  HOTEL_STAY_STATUS_BADGE_CLASS,
  HOTEL_STAY_STATUS_LABELS,
  guestDisplayName,
  type HotelStayStatusValue,
} from "@/lib/hotel/stay-status";
import { formatMontantFc } from "@/lib/reservation/labels";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

export type HotelBookingConfirmationView = {
  codeUnique: string;
  status: HotelStayStatusValue;
  guestPrenom: string;
  guestNom: string;
  roomTypeName: string;
  roomNumber: string | null;
  checkInDate: Date | string;
  checkOutDate: Date | string;
  totalAmount: number;
  paidAmount: number;
  hotelName: string;
};

type Props = {
  orgSlug: string;
  stay: HotelBookingConfirmationView;
};

export function HotelRoomBookingConfirmation({ orgSlug, stay }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.from("[data-confirm-icon]", {
        scale: 0.6,
        opacity: 0,
        duration: 0.45,
      })
        .from(
          "[data-confirm-title]",
          { y: 12, opacity: 0, duration: 0.35 },
          "-=0.15",
        )
        .from(
          "[data-confirm-body]",
          { y: 10, opacity: 0, duration: 0.35, stagger: 0.06 },
          "-=0.1",
        );
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckCircle2
          data-confirm-icon
          className="size-14 text-emerald-600 dark:text-emerald-400"
          aria-hidden
        />
        <h1
          data-confirm-title
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Réservation confirmée
        </h1>
        <p data-confirm-body className="text-sm text-muted-foreground">
          Votre séjour est enregistré. Présentez le code à la réception.
        </p>
        <p
          data-confirm-body
          className="font-mono text-lg font-semibold tracking-wide"
        >
          {stay.codeUnique}
        </p>
        <Badge
          data-confirm-body
          variant="outline"
          className={cn(HOTEL_STAY_STATUS_BADGE_CLASS[stay.status])}
        >
          {HOTEL_STAY_STATUS_LABELS[stay.status]}
        </Badge>
      </div>

      <section
        data-confirm-body
        className="flex flex-col gap-2 rounded-xl border bg-card/60 p-4 text-sm sm:p-5"
      >
        <p className="text-muted-foreground">{stay.hotelName}</p>
        <p className="font-semibold">
          {guestDisplayName(stay.guestPrenom, stay.guestNom)}
        </p>
        <p>
          {stay.roomTypeName}
          {stay.roomNumber ? ` · Chambre ${stay.roomNumber}` : ""}
        </p>
        <p className="text-muted-foreground">
          {formatStayDateFr(stay.checkInDate)} →{" "}
          {formatStayDateFr(stay.checkOutDate)}
        </p>
        <div className="mt-2 flex justify-between border-t pt-3 font-semibold">
          <span>Total payé</span>
          <span className="tabular-nums">
            {formatMontantFc(stay.paidAmount || stay.totalAmount)}
          </span>
        </div>
      </section>

      <div data-confirm-body className="flex flex-col gap-2 sm:flex-row">
        <Button
          render={<Link href={clientHotelRoutes.mesSejours(orgSlug)} />}
          className="w-full sm:w-auto"
        >
          Mes séjours
        </Button>
        <Button
          variant="outline"
          render={<Link href={clientHotelRoutes.root(orgSlug)} />}
          className="w-full sm:w-auto"
        >
          Retour hôtel
        </Button>
      </div>
    </div>
  );
}
