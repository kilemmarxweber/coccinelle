import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bus,
  Clock,
  Plane,
  Users,
} from "lucide-react";
import { CheckoutStepper, FUNNEL_STEPS } from "@/components/funnel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StartCheckoutButton } from "@/components/pwa/start-checkout-button";
import { getPublicOrganizationBySlug } from "@/lib/pwa/org";
import {
  CATEGORIE_PASSAGER_LABELS,
  MODE_TRANSPORT_LABELS,
  formatDateFr,
  formatMontantFc,
} from "@/lib/reservation/labels";
import { prixPassager } from "@/lib/reservation/pricing";
import {
  OrganizationScopeError,
  getDepartForOrganization,
} from "@/lib/search-departs";

type PageProps = {
  params: Promise<{ orgSlug: string; departId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { orgSlug, departId } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) return { title: "Organisation introuvable" };

  try {
    const depart = await getDepartForOrganization({
      organizationSlug: org.slug,
      departId,
    });
    if (!depart) return { title: `Départ — ${org.name}` };
    return {
      title: `${depart.villeDepart} → ${depart.villeArrivee} — ${org.name}`,
      description: `Départ ${formatDateFr(depart.dateDepart)} à ${depart.heureDepart}.`,
    };
  } catch {
    return { title: `Départ — ${org.name}` };
  }
}

const CATEGORIES = ["ADULTE", "ENFANT", "BEBE"] as const;

export default async function OrgDepartDetailPage({ params }: PageProps) {
  const { orgSlug, departId } = await params;
  const org = await getPublicOrganizationBySlug(orgSlug);
  if (!org) notFound();

  let depart;
  try {
    depart = await getDepartForOrganization({
      organizationSlug: org.slug,
      departId,
    });
  } catch (e) {
    if (e instanceof OrganizationScopeError) notFound();
    throw e;
  }
  if (!depart) notFound();

  const ModeIcon = depart.modeTransport === "AVION" ? Plane : Bus;
  const tarifs = {
    prixBase: depart.prixBase,
    prixParKilo: depart.prixParKilo,
    kilosGratuits: depart.kilosGratuits,
  };

  const dureeLabel =
    depart.dureeEstimee != null && depart.dureeEstimee > 0
      ? depart.dureeEstimee >= 60
        ? `${Math.floor(depart.dureeEstimee / 60)} h${depart.dureeEstimee % 60 ? ` ${depart.dureeEstimee % 60} min` : ""}`
        : `${depart.dureeEstimee} min`
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          render={<Link href={`/${org.slug}/recherche`} />}
        >
          <ArrowLeft data-icon="inline-start" aria-hidden />
          Résultats
        </Button>
      </div>

      <CheckoutStepper steps={FUNNEL_STEPS} currentStep="recherche" />

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="rounded-xl bg-primary/10 p-2.5">
                <ModeIcon className="size-5 text-primary" aria-hidden />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-xl">
                  {depart.villeDepart} → {depart.villeArrivee}
                </CardTitle>
                <CardDescription>
                  {formatDateFr(depart.dateDepart)} · {depart.heureDepart}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline">
              {MODE_TRANSPORT_LABELS[depart.modeTransport]}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="size-4 shrink-0" aria-hidden />
              <span>
                Départ à {depart.heureDepart}
                {dureeLabel ? ` · durée estimée ${dureeLabel}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="size-4 shrink-0" aria-hidden />
              <span>
                {depart.complet
                  ? "Complet"
                  : `${depart.placesRestantes} place${depart.placesRestantes !== 1 ? "s" : ""} restante${depart.placesRestantes !== 1 ? "s" : ""}`}
                {" · "}
                {depart.capacitePlaces} places au total
              </span>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Tarifs par catégorie</h2>
            <ul className="flex flex-col gap-2">
              {CATEGORIES.map((categorie) => (
                <li
                  key={categorie}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-muted-foreground">
                    {CATEGORIE_PASSAGER_LABELS[categorie]}
                  </span>
                  <span className="font-medium tabular-nums">
                    {formatMontantFc(prixPassager(tarifs, categorie))}
                  </span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Prix à partir de {formatMontantFc(depart.prixBase)} (adulte).
              Bagages : {depart.kilosGratuits} kg inclus.
            </p>
          </div>
        </CardContent>

        <CardFooter>
          <StartCheckoutButton
            orgSlug={org.slug}
            departId={depart.departId}
            disabled={depart.complet}
          />
        </CardFooter>
      </Card>
    </div>
  );
}
