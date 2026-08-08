"use client";

import { useRef, useState, useTransition } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BedDouble, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createHotelStayDraftAction,
  searchHotelRoomAvailabilityAction,
} from "@/lib/hotel/client-room-booking-actions";
import type { AvailableRoomType } from "@/lib/hotel/availability";
import {
  addCalendarDaysInput,
  todayDateOnlyInput,
} from "@/lib/hotel/folio-nights";
import { clientHotelRoutes } from "@/lib/branch/paths";
import { formatMontantFc } from "@/lib/reservation/labels";
import { useRouter } from "next/navigation";

gsap.registerPlugin(useGSAP);

type Props = {
  orgSlug: string;
  hotelName: string;
  initialCheckIn?: string;
  initialCheckOut?: string;
  initialError?: string | null;
};

export function HotelRoomSearch({
  orgSlug,
  hotelName,
  initialCheckIn,
  initialCheckOut,
  initialError,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const today = todayDateOnlyInput();
  const [checkIn, setCheckIn] = useState(initialCheckIn || today);
  const [checkOut, setCheckOut] = useState(
    initialCheckOut || addCalendarDaysInput(today, 1),
  );
  const [types, setTypes] = useState<AvailableRoomType[] | null>(null);
  const [nights, setNights] = useState(0);
  const [pending, startTransition] = useTransition();
  const [bookingId, setBookingId] = useState<string | null>(null);

  useGSAP(
    () => {
      gsap.from("[data-search]", {
        opacity: 0,
        y: 16,
        duration: 0.45,
        stagger: 0.08,
        ease: "power2.out",
      });
    },
    { scope: rootRef },
  );

  useGSAP(
    () => {
      if (!types) return;
      gsap.from("[data-result]", {
        opacity: 0,
        y: 12,
        duration: 0.4,
        stagger: 0.06,
        ease: "power2.out",
      });
    },
    { dependencies: [types], scope: rootRef, revertOnUpdate: true },
  );

  function onSearch() {
    startTransition(async () => {
      const result = await searchHotelRoomAvailabilityAction({
        orgSlug,
        checkInDate: checkIn,
        checkOutDate: checkOut,
      });
      if (!result.ok) {
        toast.error(result.error);
        setTypes(null);
        return;
      }
      setTypes(result.types);
      setNights(result.nights);
      if (result.types.every((t) => t.availableCount < 1)) {
        toast.message("Aucune chambre libre pour ces dates.");
      }
    });
  }

  function onBook(roomTypeId: string) {
    setBookingId(roomTypeId);
    startTransition(async () => {
      const result = await createHotelStayDraftAction({
        orgSlug,
        roomTypeId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
      });
      setBookingId(null);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      router.push(clientHotelRoutes.checkout(orgSlug, result.draftToken));
    });
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-8 py-2">
      <section className="flex flex-col gap-2" aria-labelledby="room-search-title">
        <h1
          data-search
          id="room-search-title"
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Réserver une chambre
        </h1>
        <p data-search className="text-sm text-muted-foreground">
          {hotelName} — tarifs en CDF. Compte requis pour confirmer.
        </p>
      </section>

      {initialError ? (
        <p data-search className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {initialError}
        </p>
      ) : null}

      <section
        data-search
        className="flex flex-col gap-4 rounded-2xl border bg-card/50 p-4 sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="check-in">Arrivée</Label>
            <Input
              id="check-in"
              type="date"
              value={checkIn}
              min={today}
              onChange={(e) => {
                const next = e.target.value;
                setCheckIn(next);
                if (checkOut <= next) {
                  setCheckOut(addCalendarDaysInput(next, 1));
                }
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="check-out">Départ</Label>
            <Input
              id="check-out"
              type="date"
              value={checkOut}
              min={addCalendarDaysInput(checkIn, 1)}
              onChange={(e) => setCheckOut(e.target.value)}
            />
          </div>
        </div>
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={pending}
          onClick={onSearch}
        >
          <Search data-icon="inline-start" aria-hidden />
          Voir les disponibilités
        </Button>
      </section>

      {types ? (
        <section className="flex flex-col gap-4" aria-live="polite">
          <p data-result className="text-sm text-muted-foreground">
            {nights} nuit{nights > 1 ? "s" : ""} — {types.filter((t) => t.availableCount > 0).length}{" "}
            type{types.filter((t) => t.availableCount > 0).length > 1 ? "s" : ""}{" "}
            disponible
            {types.filter((t) => t.availableCount > 0).length > 1 ? "s" : ""}
          </p>
          <ul className="flex flex-col gap-3">
            {types.map((t) => {
              const soldOut = t.availableCount < 1;
              return (
                <li
                  key={t.roomTypeId}
                  data-result
                  className="flex flex-col gap-3 rounded-xl border bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <BedDouble className="size-5" aria-hidden />
                    </span>
                    <div>
                      <h2 className="font-semibold">{t.name}</h2>
                      {t.description ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {t.description}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-muted-foreground">
                        Jusqu’à {t.capacity} pers. ·{" "}
                        {soldOut
                          ? "Complet"
                          : `${t.availableCount} libre${t.availableCount > 1 ? "s" : ""}`}
                      </p>
                      <p className="mt-2 text-sm">
                        <span className="font-medium tabular-nums">
                          {formatMontantFc(t.priceNight)}
                        </span>
                        <span className="text-muted-foreground"> / nuit</span>
                        {" · "}
                        <span className="font-semibold tabular-nums">
                          {formatMontantFc(t.totalAmount)}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          total
                        </span>
                      </p>
                    </div>
                  </div>
                  <Button
                    className="w-full shrink-0 sm:w-auto"
                    disabled={soldOut || pending}
                    onClick={() => onBook(t.roomTypeId)}
                  >
                    {bookingId === t.roomTypeId
                      ? "Préparation…"
                      : soldOut
                        ? "Indisponible"
                        : "Réserver"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
