"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { LogIn, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/auth-client";
import { clientHotelRoutes } from "@/lib/branch/paths";
import {
  advanceHotelStayDraftStepAction,
  payAndConfirmHotelStayDraftAction,
  updateHotelStayDraftAction,
} from "@/lib/hotel/client-room-booking-actions";
import {
  formatStayDateFr,
  parseDateOnlyInput,
} from "@/lib/hotel/folio-nights";
import type { HotelStayDraftPayload } from "@/lib/hotel/stay-draft-schema";
import { formatMontantFc } from "@/lib/reservation/labels";
import { cn } from "@/lib/utils";

gsap.registerPlugin(useGSAP);

const STEPS = [
  { id: "guest" as const, label: "Coordonnées" },
  { id: "paiement" as const, label: "Paiement" },
];

type Props = {
  orgSlug: string;
  draftToken: string;
  hotelName: string;
  expiresAt: string;
  expired: boolean;
  initialPayload: HotelStayDraftPayload;
};

export function HotelRoomBookingFunnel({
  orgSlug,
  draftToken,
  hotelName,
  expiresAt,
  expired: initiallyExpired,
  initialPayload,
}: Props) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const { data: session, isPending: sessionPending } = useSession();
  const [payload, setPayload] = useState(initialPayload);
  const [expired] = useState(initiallyExpired);
  const [stepError, setStepError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const signInHref = `/auth/sign-in?callbackUrl=${encodeURIComponent(
    clientHotelRoutes.checkout(orgSlug, draftToken),
  )}`;
  const signUpHref = `/auth/sign-up?callbackUrl=${encodeURIComponent(
    clientHotelRoutes.checkout(orgSlug, draftToken),
  )}`;

  useGSAP(
    () => {
      gsap.from("[data-funnel-step]", {
        opacity: 0,
        y: 16,
        duration: 0.45,
        ease: "power2.out",
      });
    },
    { dependencies: [payload.step], scope: rootRef, revertOnUpdate: true },
  );

  const checkIn = parseDateOnlyInput(payload.checkInDate);
  const checkOut = parseDateOnlyInput(payload.checkOutDate);

  function patchGuest(
    field: "guestPrenom" | "guestNom" | "guestPhone",
    value: string,
  ) {
    setPayload((prev) => ({ ...prev, [field]: value }));
  }

  function saveDraft(next: HotelStayDraftPayload) {
    startTransition(async () => {
      const result = await updateHotelStayDraftAction({
        orgSlug,
        draftToken,
        payload: next,
      });
      if (!result.ok) {
        toast.error(result.error);
        if (result.code === "EXPIRED") router.refresh();
      }
    });
  }

  function goToPayment() {
    setStepError(null);
    startTransition(async () => {
      const result = await advanceHotelStayDraftStepAction({
        orgSlug,
        draftToken,
        payload,
      });
      if (!result.ok) {
        setStepError(result.error);
        if (result.code === "EXPIRED") router.refresh();
        return;
      }
      setPayload((prev) => ({ ...prev, step: "paiement" }));
    });
  }

  function pay() {
    if (!session?.user) {
      router.push(signInHref);
      return;
    }
    setStepError(null);
    startTransition(async () => {
      const result = await payAndConfirmHotelStayDraftAction({
        orgSlug,
        draftToken,
      });
      if (!result.ok) {
        setStepError(result.error);
        toast.error(result.error);
        if (result.code === "UNAUTHENTICATED") {
          router.push(signInHref);
          return;
        }
        if (result.code === "EXPIRED" || result.code === "CAPACITY") {
          router.refresh();
        }
        return;
      }
      router.push(clientHotelRoutes.confirmation(orgSlug, result.codeUnique));
    });
  }

  if (expired) {
    return (
      <div className="flex flex-col gap-4 py-4">
        <Alert variant="destructive">
          <AlertTitle>Brouillon expiré</AlertTitle>
          <AlertDescription>
            Recommencez une recherche pour réserver une chambre.
          </AlertDescription>
        </Alert>
        <Button render={<Link href={clientHotelRoutes.recherche(orgSlug)} />}>
          Nouvelle recherche
        </Button>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-6 py-2">
      <div>
        <p className="text-sm text-muted-foreground">{hotelName}</p>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Finaliser la réservation
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Brouillon valide jusqu’à{" "}
          {new Date(expiresAt).toLocaleString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <nav aria-label="Étapes" className="flex gap-2">
        {STEPS.map((s, i) => {
          const active = payload.step === s.id;
          const done =
            (s.id === "guest" && payload.step === "paiement") || active;
          return (
            <div
              key={s.id}
              className={cn(
                "flex flex-1 flex-col gap-1 rounded-lg border px-3 py-2 text-center text-xs sm:text-sm",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : done
                    ? "border-border bg-muted/40 text-muted-foreground"
                    : "border-border text-muted-foreground",
              )}
            >
              <span className="font-medium">
                {i + 1}. {s.label}
              </span>
            </div>
          );
        })}
      </nav>

      <section
        data-funnel-step
        className="rounded-xl border bg-card/60 p-4 text-sm sm:p-5"
      >
        <p className="font-semibold">{payload.roomTypeName}</p>
        <p className="mt-1 text-muted-foreground">
          {checkIn ? formatStayDateFr(checkIn) : payload.checkInDate}
          {" → "}
          {checkOut ? formatStayDateFr(checkOut) : payload.checkOutDate}
          {" · "}
          {payload.nights} nuit{payload.nights > 1 ? "s" : ""}
        </p>
        <p className="mt-2">
          <span className="text-muted-foreground">
            {formatMontantFc(payload.priceNight)} / nuit ·{" "}
          </span>
          <span className="font-semibold tabular-nums">
            {formatMontantFc(payload.totalAmount)}
          </span>
        </p>
      </section>

      {stepError ? (
        <Alert variant="destructive">
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      ) : null}

      {payload.step === "guest" ? (
        <section data-funnel-step className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prenom">Prénom</Label>
              <Input
                id="prenom"
                value={payload.guestPrenom}
                onChange={(e) => patchGuest("guestPrenom", e.target.value)}
                onBlur={() =>
                  saveDraft({ ...payload, guestPrenom: payload.guestPrenom })
                }
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nom">Nom</Label>
              <Input
                id="nom"
                value={payload.guestNom}
                onChange={(e) => patchGuest("guestNom", e.target.value)}
                onBlur={() =>
                  saveDraft({ ...payload, guestNom: payload.guestNom })
                }
                autoComplete="family-name"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone</Label>
            <Input
              id="phone"
              type="tel"
              value={payload.guestPhone}
              onChange={(e) => patchGuest("guestPhone", e.target.value)}
              onBlur={() =>
                saveDraft({ ...payload, guestPhone: payload.guestPhone })
              }
              autoComplete="tel"
            />
          </div>
          <Button
            size="lg"
            className="w-full sm:w-auto"
            disabled={pending}
            onClick={goToPayment}
          >
            Continuer vers le paiement
          </Button>
        </section>
      ) : (
        <section data-funnel-step className="flex flex-col gap-4">
          <div className="rounded-xl border bg-muted/30 p-4 text-sm">
            <p>
              {payload.guestPrenom} {payload.guestNom}
            </p>
            <p className="text-muted-foreground">{payload.guestPhone}</p>
            <Button
              variant="link"
              className="h-auto px-0"
              onClick={() =>
                setPayload((prev) => ({ ...prev, step: "guest" }))
              }
            >
              Modifier
            </Button>
          </div>

          {!sessionPending && !session?.user ? (
            <Alert>
              <AlertTitle>Compte requis</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>
                  Connectez-vous ou créez un compte pour confirmer (obligatoire
                  pour toutes les réservations, y compris plusieurs nuits).
                </span>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button render={<Link href={signInHref} />}>
                    <LogIn data-icon="inline-start" aria-hidden />
                    Se connecter
                  </Button>
                  <Button
                    variant="outline"
                    render={<Link href={signUpHref} />}
                  >
                    <UserPlus data-icon="inline-start" aria-hidden />
                    Créer un compte
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              Paiement Mobile Money (mode démo) — montant{" "}
              <span className="font-medium text-foreground tabular-nums">
                {formatMontantFc(payload.totalAmount)}
              </span>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={pending || sessionPending || !session?.user}
              onClick={pay}
            >
              {pending ? "Paiement…" : "Payer et confirmer"}
            </Button>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              disabled={pending}
              onClick={() =>
                setPayload((prev) => ({ ...prev, step: "guest" }))
              }
            >
              Retour
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
