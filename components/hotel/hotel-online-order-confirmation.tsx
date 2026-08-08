"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { GuestFoodOrderView } from "@/lib/hotel/client-online-order";
import {
  HOTEL_FOOD_ORDER_STATUS_BADGE_CLASS,
  HOTEL_FOOD_ORDER_STATUS_LABELS,
} from "@/lib/hotel/food-order-status";
import { clientHotelRoutes } from "@/lib/branch/paths";
import { formatMontantFc } from "@/lib/reservation/labels";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

type Props = {
  orgSlug: string;
  order: GuestFoodOrderView;
};

export function HotelOnlineOrderConfirmation({ orgSlug, order }: Props) {
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
          Commande confirmée
        </h1>
        <p data-confirm-body className="text-sm text-muted-foreground">
          La cuisine a reçu votre room service. Le personnel avance le statut
          jusqu’à « Servie ».
        </p>
        <Badge
          data-confirm-body
          variant="outline"
          className={cn(HOTEL_FOOD_ORDER_STATUS_BADGE_CLASS[order.status])}
        >
          {HOTEL_FOOD_ORDER_STATUS_LABELS[order.status]}
        </Badge>
      </div>

      <section
        data-confirm-body
        className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4 sm:p-5"
      >
        <div className="text-sm text-muted-foreground">
          {order.stayGuestName ? <p>{order.stayGuestName}</p> : null}
          {order.stayRoomNumber ? (
            <p>Chambre {order.stayRoomNumber}</p>
          ) : null}
        </div>
        <ul className="space-y-2 text-sm">
          {order.lines.map((line) => (
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
        {order.notes ? (
          <p className="text-sm text-muted-foreground">Note : {order.notes}</p>
        ) : null}
        <div className="flex justify-between border-t pt-3 font-semibold">
          <span>Total</span>
          <span className="tabular-nums">
            {formatMontantFc(order.totalAmount)}
          </span>
        </div>
      </section>

      <div data-confirm-body className="flex flex-col gap-2 sm:flex-row">
        <Button
          render={<Link href={clientHotelRoutes.commande(orgSlug)} />}
          className="w-full sm:w-auto"
        >
          Nouvelle commande
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
