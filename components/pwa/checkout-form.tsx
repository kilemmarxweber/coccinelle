"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  LogIn,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  advanceCheckoutStepAction,
  updateCheckoutDraftAction,
} from "@/lib/reservation/checkout-actions";
import { payAndConfirmOnlineCheckoutAction } from "@/lib/reservation/online-checkout-actions";
import { ONLINE_PAYMENT_MODE } from "@/lib/reservation/payment-stub";
import { useSession } from "@/lib/auth-client";
import {
  CheckoutStepper,
  FUNNEL_STEPS,
  PassengerForm,
  PriceSummary,
  type PassengerFormValues,
} from "@/components/funnel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
  FieldLegend,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { DraftColis, DraftPayload } from "@/lib/reservation/draft-schema";
import { formatDateFr, formatMontantFc } from "@/lib/reservation/labels";
import type { TrajetTarifs } from "@/lib/reservation/pricing";

function placesDemandeesFromPassagers(
  passagers: Array<{ categorie: string }>,
): number {
  return passagers.filter((p) => p.categorie !== "BEBE").length;
}
const AUTOSAVE_MS = 600;
const MAX_PASSAGERS = 9;

type DepartSummary = {
  departId: string;
  villeDepart: string;
  villeArrivee: string;
  dateDepart: string;
  heureDepart: string;
  placesRestantes: number;
  kilosGratuits: number;
  prixParKilo: number;
};

type CheckoutFormProps = {
  orgSlug: string;
  draftToken: string;
  expiresAtIso: string;
  initialPayload: DraftPayload;
  initialPlacesRestantes: number;
  depart: DepartSummary;
  tarifs: TrajetTarifs;
};

function toPassengerValues(
  p: DraftPayload["passagers"][number],
): PassengerFormValues {
  return {
    prenom: p.prenom,
    nom: p.nom,
    sexe: p.sexe,
    categorie: p.categorie,
    telephone: p.telephone ?? "",
  };
}

export function CheckoutForm({
  orgSlug,
  draftToken,
  expiresAtIso,
  initialPayload,
  initialPlacesRestantes,
  depart,
  tarifs,
}: CheckoutFormProps) {
  const router = useRouter();
  const { data: session, isPending: sessionPending } = useSession();
  const [payload, setPayload] = React.useState<DraftPayload>(initialPayload);
  const [placesRestantes, setPlacesRestantes] = React.useState(
    initialPlacesRestantes,
  );
  const [saveState, setSaveState] = React.useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [stepError, setStepError] = React.useState<string | null>(null);
  const [advancing, startAdvance] = React.useTransition();
  const [paying, startPay] = React.useTransition();
  const skipFirstSave = React.useRef(true);

  const step =
    payload.step === "paiement"
      ? "paiement"
      : payload.step === "options"
        ? "options"
        : "passagers";

  const adultCount = payload.passagers.filter((p) => p.categorie === "ADULTE")
    .length;
  const enfantCount = payload.passagers.filter((p) => p.categorie === "ENFANT")
    .length;
  const bebeCount = payload.passagers.filter((p) => p.categorie === "BEBE")
    .length;
  const siegesDemandes = placesDemandeesFromPassagers(payload.passagers);

  const colisPricing =
    payload.colis.include && payload.colis.type
      ? {
          type: payload.colis.type,
          poids: payload.colis.poids,
          montantFixe: payload.colis.montantFixe,
        }
      : undefined;

  const signInHref = `/auth/sign-in?callbackUrl=${encodeURIComponent(
    `/${orgSlug}/checkout/${draftToken}`,
  )}`;

  // Autosave debounced
  React.useEffect(() => {
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }

    setSaveState("saving");
    const timer = window.setTimeout(async () => {
      const result = await updateCheckoutDraftAction({
        orgSlug,
        draftToken,
        payload,
      });
      if (!result.ok) {
        setSaveState("error");
        if (result.code === "EXPIRED") {
          toast.error(result.error);
          router.refresh();
          return;
        }
        if (result.code === "CAPACITY") {
          setStepError(result.error);
          toast.error(result.error);
          return;
        }
        toast.error(result.error);
        return;
      }
      if (result.placesRestantes != null) {
        setPlacesRestantes(result.placesRestantes);
      }
      setSaveState("saved");
    }, AUTOSAVE_MS);

    return () => window.clearTimeout(timer);
  }, [payload, orgSlug, draftToken, router]);

  function patchPassager(index: number, values: PassengerFormValues) {
    setStepError(null);
    setPayload((prev) => {
      const passagers = [...prev.passagers];
      passagers[index] = {
        nom: values.nom,
        prenom: values.prenom,
        sexe: values.sexe,
        categorie: values.categorie,
        telephone: values.telephone,
      };
      return { ...prev, passagers };
    });
  }

  function addPassager() {
    if (payload.passagers.length >= MAX_PASSAGERS) return;
    if (siegesDemandes >= placesRestantes) {
      setStepError(
        `Capacité insuffisante : ${placesRestantes} place${placesRestantes !== 1 ? "s" : ""} restante${placesRestantes !== 1 ? "s" : ""}.`,
      );
      return;
    }
    setPayload((prev) => ({
      ...prev,
      passagers: [
        ...prev.passagers,
        {
          nom: "",
          prenom: "",
          sexe: "M" as const,
          categorie: "ADULTE" as const,
          telephone: "",
        },
      ],
    }));
  }

  function removePassager(index: number) {
    setPayload((prev) => {
      if (prev.passagers.length <= 1) return prev;
      return {
        ...prev,
        passagers: prev.passagers.filter((_, i) => i !== index),
      };
    });
  }

  function patchColis(partial: Partial<DraftColis>) {
    setStepError(null);
    setPayload((prev) => ({
      ...prev,
      colis: { ...prev.colis, ...partial },
    }));
  }

  function goToStep(next: "passagers" | "options" | "paiement") {
    setPayload((prev) => ({ ...prev, step: next }));
  }

  function advance(toStep: "options" | "paiement") {
    setStepError(null);
    startAdvance(async () => {
      const result = await advanceCheckoutStepAction({
        orgSlug,
        draftToken,
        payload,
        toStep,
      });
      if (!result.ok) {
        setStepError(result.error);
        toast.error(result.error);
        if (result.code === "EXPIRED") router.refresh();
        return;
      }
      if (result.placesRestantes != null) {
        setPlacesRestantes(result.placesRestantes);
      }
      goToStep(toStep);
    });
  }

  function pay() {
    if (!session?.user) {
      toast.error("Connectez-vous pour payer.");
      router.push(signInHref);
      return;
    }
    setStepError(null);
    startPay(async () => {
      const result = await payAndConfirmOnlineCheckoutAction({
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
        if (result.code === "EXPIRED") router.refresh();
        return;
      }
      toast.success("Paiement confirmé — réservation créée.");
      router.push(`/${orgSlug}/confirmation/${result.codeUnique}`);
    });
  }

  const expiresLabel = new Date(expiresAtIso).toLocaleString("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          render={
            <Link href={`/${orgSlug}/departs/${depart.departId}`} />
          }
        >
          <ArrowLeft data-icon="inline-start" aria-hidden />
          Départ
        </Button>
      </div>

      <CheckoutStepper
        steps={FUNNEL_STEPS}
        currentStep={step}
        onStepClick={(id) => {
          if (id === "passagers") goToStep("passagers");
          if (id === "options" && (step === "options" || step === "paiement")) {
            goToStep("options");
          }
          if (id === "paiement" && step === "paiement") {
            goToStep("paiement");
          }
        }}
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            {depart.villeDepart} → {depart.villeArrivee}
          </CardTitle>
          <CardDescription className="flex flex-col gap-1">
            <span>
              {formatDateFr(depart.dateDepart)} · {depart.heureDepart}
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <Clock className="size-3.5" aria-hidden />
              Brouillon valable jusqu’à {expiresLabel}
              {" · "}
              {placesRestantes} place
              {placesRestantes !== 1 ? "s" : ""} restante
              {placesRestantes !== 1 ? "s" : ""}
            </span>
          </CardDescription>
        </CardHeader>
      </Card>

      {stepError ? (
        <Alert variant="destructive">
          <AlertTitle>Impossible de continuer</AlertTitle>
          <AlertDescription>{stepError}</AlertDescription>
        </Alert>
      ) : null}

      {step === "passagers" ? (
        <div className="flex flex-col gap-4">
          {payload.passagers.map((p, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-base">
                    Passager {index + 1}
                  </CardTitle>
                </div>
                {payload.passagers.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Retirer le passager ${index + 1}`}
                    onClick={() => removePassager(index)}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent>
                <PassengerForm
                  idPrefix={`pax-${index}`}
                  legend=""
                  description=""
                  values={toPassengerValues(p)}
                  onChange={(v) => patchPassager(index, v)}
                />
              </CardContent>
            </Card>
          ))}

          <Button
            type="button"
            variant="outline"
            className="h-11"
            disabled={payload.passagers.length >= MAX_PASSAGERS}
            onClick={addPassager}
          >
            <Plus data-icon="inline-start" aria-hidden />
            Ajouter un passager
          </Button>

          <PriceSummary
            tarifs={tarifs}
            adultCount={adultCount}
            enfantCount={enfantCount}
            bebeCount={bebeCount}
            colis={colisPricing}
            maxAdults={placesRestantes}
            description={`À partir de ${formatMontantFc(tarifs.prixBase)} / adulte`}
          />

          <Button
            type="button"
            className="h-11 w-full"
            size="lg"
            disabled={advancing}
            onClick={() => advance("options")}
          >
            {advancing ? <Spinner data-icon="inline-start" /> : null}
            Continuer vers les options
            <ArrowRight data-icon="inline-end" aria-hidden />
          </Button>
        </div>
      ) : null}

      {step === "options" ? (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Colis</CardTitle>
                  <CardDescription>
                    Optionnel. Destinataire obligatoire si un colis est ajouté.
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant={payload.colis.include ? "default" : "outline"}
                  size="sm"
                  onClick={() =>
                    patchColis({
                      include: !payload.colis.include,
                      type: payload.colis.type ?? "ORDINAIRE",
                    })
                  }
                >
                  {payload.colis.include ? "Inclus" : "Ajouter"}
                </Button>
              </div>
            </CardHeader>
            {payload.colis.include ? (
              <CardContent>
                <FieldSet>
                  <FieldLegend className="sr-only">Options colis</FieldLegend>
                  <FieldGroup className="gap-4 sm:grid sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor="colis-type">Type</FieldLabel>
                      <Select
                        id="colis-type"
                        className="h-11"
                        value={payload.colis.type ?? "ORDINAIRE"}
                        onChange={(e) =>
                          patchColis({
                            type: e.target.value as "ORDINAIRE" | "SPECIAL",
                          })
                        }
                      >
                        <option value="ORDINAIRE">Ordinaire</option>
                        <option value="SPECIAL">Spécial</option>
                      </Select>
                    </Field>
                    {(payload.colis.type ?? "ORDINAIRE") === "ORDINAIRE" ? (
                      <Field>
                        <FieldLabel htmlFor="colis-poids">Poids (kg)</FieldLabel>
                        <Input
                          id="colis-poids"
                          type="number"
                          min={0}
                          className="h-11"
                          value={payload.colis.poids ?? ""}
                          onChange={(e) => patchColis({ poids: e.target.value })}
                        />
                        <FieldDescription>
                          {depart.kilosGratuits} kg gratuits, puis{" "}
                          {formatMontantFc(depart.prixParKilo)}/kg
                        </FieldDescription>
                      </Field>
                    ) : (
                      <Field>
                        <FieldLabel htmlFor="colis-montant">
                          Montant fixe
                        </FieldLabel>
                        <Input
                          id="colis-montant"
                          type="number"
                          min={0}
                          className="h-11"
                          value={payload.colis.montantFixe ?? ""}
                          onChange={(e) =>
                            patchColis({
                              montantFixe: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </Field>
                    )}
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor="colis-commentaire">
                        Commentaire
                      </FieldLabel>
                      <Textarea
                        id="colis-commentaire"
                        rows={2}
                        value={payload.colis.commentaire ?? ""}
                        onChange={(e) =>
                          patchColis({ commentaire: e.target.value })
                        }
                      />
                    </Field>
                  </FieldGroup>

                  <FieldGroup className="mt-4 gap-4 sm:grid sm:grid-cols-2">
                    <p className="sm:col-span-2 text-sm font-medium">
                      Destinataire à destination
                    </p>
                    <Field>
                      <FieldLabel htmlFor="destinataire-nom">
                        Nom complet
                      </FieldLabel>
                      <Input
                        id="destinataire-nom"
                        className="h-11"
                        value={payload.colis.destinataireNom ?? ""}
                        onChange={(e) =>
                          patchColis({ destinataireNom: e.target.value })
                        }
                        required
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="destinataire-tel">
                        Téléphone
                      </FieldLabel>
                      <Input
                        id="destinataire-tel"
                        type="tel"
                        className="h-11"
                        value={payload.colis.destinataireTel ?? ""}
                        onChange={(e) =>
                          patchColis({ destinataireTel: e.target.value })
                        }
                        required
                      />
                    </Field>
                    <Field className="sm:col-span-2">
                      <FieldLabel htmlFor="destinataire-id">
                        Pièce d&apos;identité
                      </FieldLabel>
                      <Input
                        id="destinataire-id"
                        className="h-11"
                        value={payload.colis.destinataireId ?? ""}
                        onChange={(e) =>
                          patchColis({ destinataireId: e.target.value })
                        }
                        placeholder="N° carte / passeport"
                        required
                      />
                      <FieldDescription>
                        Personne autorisée à récupérer le colis à l&apos;arrivée.
                      </FieldDescription>
                    </Field>
                  </FieldGroup>
                </FieldSet>
              </CardContent>
            ) : null}
          </Card>

          <PriceSummary
            tarifs={tarifs}
            adultCount={adultCount}
            enfantCount={enfantCount}
            bebeCount={bebeCount}
            colis={colisPricing}
            description="Récapitulatif vivant"
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              onClick={() => goToStep("passagers")}
            >
              <ArrowLeft data-icon="inline-start" aria-hidden />
              Passagers
            </Button>
            <Button
              type="button"
              className="h-11 flex-1"
              size="lg"
              disabled={advancing}
              onClick={() => advance("paiement")}
            >
              {advancing ? <Spinner data-icon="inline-start" /> : null}
              Continuer vers le paiement
              <ArrowRight data-icon="inline-end" aria-hidden />
            </Button>
          </div>
        </div>
      ) : null}

      {step === "paiement" ? (
        <div className="flex flex-col gap-4">
          <PriceSummary
            tarifs={tarifs}
            adultCount={adultCount}
            enfantCount={enfantCount}
            bebeCount={bebeCount}
            colis={colisPricing}
            title="À payer"
            description="La réservation définitive sera créée après confirmation du paiement."
          />

          {!sessionPending && !session?.user ? (
            <Alert>
              <AlertTitle>Connexion requise</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <span>
                  Connectez-vous (ou créez un compte) pour finaliser le paiement.
                </span>
                <Button
                  type="button"
                  className="h-11 w-full sm:w-auto"
                  render={<Link href={signInHref} />}
                >
                  <LogIn data-icon="inline-start" aria-hidden />
                  Se connecter pour payer
                </Button>
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTitle>
                Paiement {ONLINE_PAYMENT_MODE === "stub" ? "démo (stub)" : ""}
              </AlertTitle>
              <AlertDescription>
                Aucun prestataire Mobile Money n’est branché : le paiement est
                simulé et la réservation passe immédiatement en{" "}
                <strong>payé</strong>. TODO prestataire pour la production.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="h-11 flex-1"
              disabled={paying}
              onClick={() => goToStep("options")}
            >
              <ArrowLeft data-icon="inline-start" aria-hidden />
              Options
            </Button>
            <Button
              type="button"
              className="h-11 flex-1"
              size="lg"
              disabled={
                paying || sessionPending || !session?.user
              }
              onClick={pay}
            >
              {paying ? <Spinner data-icon="inline-start" /> : null}
              {session?.user ? "Payer maintenant" : "Payer (connexion requise)"}
            </Button>
          </div>
        </div>
      ) : null}

      <p
        className="text-center text-xs text-muted-foreground"
        aria-live="polite"
      >
        {saveState === "saving"
          ? "Enregistrement…"
          : saveState === "saved"
            ? "Brouillon enregistré"
            : saveState === "error"
              ? "Échec de l’enregistrement"
              : "\u00a0"}
      </p>
    </div>
  );
}
