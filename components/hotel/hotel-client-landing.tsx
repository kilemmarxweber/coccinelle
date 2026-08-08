"use client";

import { useRef } from "react";
import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { BedDouble, ConciergeBell, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clientHotelRoutes } from "@/lib/branch/paths";

gsap.registerPlugin(useGSAP);

type Props = {
  orgSlug: string;
  hotelName: string;
  orgName: string;
};

export function HotelClientLanding({ orgSlug, hotelName, orgName }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.from("[data-land]", {
        opacity: 0,
        y: 18,
        duration: 0.5,
        stagger: 0.1,
        ease: "power2.out",
      });
    },
    { scope: rootRef },
  );

  return (
    <div ref={rootRef} className="flex flex-col gap-8 py-2">
      <section className="flex flex-col gap-3" aria-labelledby="hotel-client-title">
        <p data-land className="text-sm text-muted-foreground">
          {orgName}
        </p>
        <h1
          data-land
          id="hotel-client-title"
          className="text-3xl font-bold tracking-tight sm:text-4xl"
        >
          {hotelName}
        </h1>
        <p data-land className="max-w-md text-sm text-muted-foreground sm:text-base">
          Réservez une chambre ou une table en ligne, ou commande room service
          si vous êtes déjà en séjour. Montants en CDF.
        </p>
      </section>

      <section
        data-land
        className="flex flex-col gap-4 rounded-2xl border bg-card/50 p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <BedDouble className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Réserver une chambre</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Dates → disponibilités → compte → paiement démo. Vos séjours
              restent dans « Mes séjours ».
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            render={<Link href={clientHotelRoutes.recherche(orgSlug)} />}
          >
            Voir les disponibilités
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full sm:w-auto"
            render={<Link href={clientHotelRoutes.mesSejours(orgSlug)} />}
          >
            Mes séjours
          </Button>
        </div>
      </section>

      <section
        data-land
        className="flex flex-col gap-4 rounded-2xl border bg-card/50 p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <UtensilsCrossed className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Réserver une table</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Heure précise, seule ou avec précommande. Sur place sans
              réservation : demandez au serveur.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          className="w-full sm:w-auto"
          render={<Link href={clientHotelRoutes.table(orgSlug)} />}
        >
          Réserver une table
        </Button>
      </section>

      <section
        data-land
        className="flex flex-col gap-4 rounded-2xl border bg-card/50 p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <ConciergeBell className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Room service</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Carte → panier → commande facturée au folio de votre séjour.
            </p>
          </div>
        </div>
        <Button
          size="lg"
          variant="outline"
          className="w-full sm:w-auto"
          render={<Link href={clientHotelRoutes.commande(orgSlug)} />}
        >
          Commander à manger
        </Button>
      </section>
    </div>
  );
}
