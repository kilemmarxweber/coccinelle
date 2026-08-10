"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { Button } from "@/components/ui/button";
import { clientHotelRoutes } from "@/lib/branch/paths";
import { formatMontantFc } from "@/lib/reservation/labels";
import type {
  LandingMenuItem,
  LandingRoomType,
} from "@/lib/hotel/list-landing";

gsap.registerPlugin(useGSAP);

type Props = {
  orgSlug: string;
  hotelName: string;
  orgName: string;
  roomTypes: LandingRoomType[];
  featuredDishes: LandingMenuItem[];
};

export function HotelClientLanding({
  orgSlug,
  hotelName,
  orgName,
  roomTypes,
  featuredDishes,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
        tl.from("[data-land-hero]", {
          opacity: 0,
          y: 22,
          duration: 0.55,
          stagger: 0.08,
        })
          .from(
            "[data-land-room]",
            {
              opacity: 0,
              y: 28,
              duration: 0.45,
              stagger: 0.1,
            },
            "-=0.15",
          )
          .from(
            "[data-land-dish]",
            {
              opacity: 0,
              y: 24,
              duration: 0.4,
              stagger: 0.08,
            },
            "-=0.2",
          );
      });

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(
          ["[data-land-hero]", "[data-land-room]", "[data-land-dish]"],
          { opacity: 1, y: 0 },
        );
      });

      return () => mm.revert();
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-14 pb-4">
      <section
        className="flex flex-col gap-3 pt-2"
        aria-labelledby="hotel-client-title"
      >
        <p
          data-land-hero
          className="text-sm font-medium tracking-wide text-muted-foreground"
        >
          {orgName}
        </p>
        <h1
          data-land-hero
          id="hotel-client-title"
          className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl"
        >
          {hotelName}
        </h1>
        <p
          data-land-hero
          className="max-w-xl text-base text-muted-foreground sm:text-lg"
        >
          Chambres et table en ligne, room service si vous êtes en séjour.
          Tarifs en CDF.
        </p>
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="hotel-rooms">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="hotel-rooms"
              className="text-2xl font-semibold tracking-tight"
            >
              Chambres
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choisissez un type, puis cherchez vos dates.
            </p>
          </div>
          <Button
            size="lg"
            className="w-full sm:w-auto"
            render={<Link href={clientHotelRoutes.recherche(orgSlug)} />}
          >
            Voir les disponibilités
          </Button>
        </div>

        {roomTypes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun type de chambre pour le moment.
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {roomTypes.map((room) => (
              <li
                key={room.id}
                data-land-room
                className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/40"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  {room.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Unsplash demo URLs
                    <img
                      src={room.imageUrl}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                      Sans image
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="text-lg font-semibold leading-snug">
                    {room.name}
                  </h3>
                  {room.description ? (
                    <p className="text-sm text-muted-foreground">
                      {room.description}
                    </p>
                  ) : null}
                  <p className="mt-auto pt-1 text-sm font-medium tabular-nums">
                    {formatMontantFc(room.priceNight)}{" "}
                    <span className="font-normal text-muted-foreground">
                      / nuit
                    </span>
                  </p>
                  <Button
                    variant="outline"
                    className="mt-1 w-full"
                    render={
                      <Link href={clientHotelRoutes.recherche(orgSlug)} />
                    }
                  >
                    Réserver
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-5" aria-labelledby="hotel-food">
        <div>
          <h2
            id="hotel-food"
            className="text-2xl font-semibold tracking-tight"
          >
            Restauration
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Commandez en room service ou réservez une table (± précommande).
          </p>
        </div>

        {featuredDishes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Carte bientôt disponible.
          </p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featuredDishes.map((dish) => (
              <li
                key={dish.id}
                data-land-dish
                className="flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/40"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                  {dish.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Unsplash demo URLs
                    <img
                      src={dish.imageUrl}
                      alt=""
                      className="size-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
                      Sans image
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-1.5 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {dish.categoryName}
                  </p>
                  <h3 className="text-lg font-semibold leading-snug">
                    {dish.name}
                  </h3>
                  {dish.description ? (
                    <p className="text-sm text-muted-foreground">
                      {dish.description}
                    </p>
                  ) : null}
                  <p className="mt-auto pt-1 text-sm font-medium tabular-nums">
                    {formatMontantFc(dish.price)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            render={<Link href={clientHotelRoutes.commande(orgSlug)} />}
          >
            Commander à manger
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
            render={<Link href={clientHotelRoutes.table(orgSlug)} />}
          >
            Réserver une table
          </Button>
        </div>
      </section>
    </div>
  );
}
