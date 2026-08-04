"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMontantFc } from "@/lib/reservation/labels";
import type { GuichetFormState } from "./use-guichet-form";

type Props = { form: GuichetFormState };

export function GuichetColisSection({ form }: Props) {
  const { colis, passagers, voyage } = form;
  const colisOnly = passagers.nombrePlaces === 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Colis</CardTitle>
          {!colisOnly && (
            <Button
              type="button"
              variant={colis.include ? "default" : "outline"}
              size="sm"
              onClick={() => colis.setInclude((v) => !v)}
            >
              {colis.include ? "Inclus" : "Ajouter"}
            </Button>
          )}
        </div>
        {colis.show && (
          <CardDescription>
            {colisOnly
              ? "Réservation colis uniquement — destinataire obligatoire."
              : "Optionnel en complément des billets. Destinataire obligatoire si colis inclus."}
          </CardDescription>
        )}
      </CardHeader>
      {colis.show && (
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="colis-type">Type</FieldLabel>
            <Select
              id="colis-type"
              className="h-11"
              value={colis.type}
              onChange={(e) => colis.setType(e.target.value as "ORDINAIRE" | "SPECIAL")}
            >
              <option value="ORDINAIRE">Ordinaire</option>
              <option value="SPECIAL">Spécial</option>
            </Select>
          </Field>
          {colis.type === "ORDINAIRE" ? (
            <Field>
              <FieldLabel htmlFor="colis-poids">Poids (kg)</FieldLabel>
              <Input
                id="colis-poids"
                type="number"
                min={0}
                className="h-11"
                value={colis.poids}
                onChange={(e) => colis.setPoids(e.target.value)}
              />
              {voyage.selectedTrajet && (
                <FieldDescription>
                  {voyage.selectedTrajet.kilosGratuits} kg gratuits, puis{" "}
                  {formatMontantFc(voyage.selectedTrajet.prixParKilo)}/kg
                </FieldDescription>
              )}
            </Field>
          ) : (
            <Field>
              <FieldLabel htmlFor="colis-montant">Montant fixe</FieldLabel>
              <Input
                id="colis-montant"
                type="number"
                min={0}
                className="h-11"
                value={colis.montant}
                onChange={(e) => colis.setMontant(e.target.value)}
              />
            </Field>
          )}
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="colis-commentaire">Commentaire</FieldLabel>
            <Textarea
              id="colis-commentaire"
              value={colis.commentaire}
              onChange={(e) => colis.setCommentaire(e.target.value)}
              rows={2}
            />
          </Field>

          <div className="sm:col-span-2">
            <p className="mb-3 text-sm font-medium">Destinataire à destination</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="destinataire-nom">Nom complet</FieldLabel>
                <Input
                  id="destinataire-nom"
                  className="h-11"
                  value={colis.destinataireNom}
                  onChange={(e) => colis.setDestinataireNom(e.target.value)}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="destinataire-tel">Téléphone</FieldLabel>
                <Input
                  id="destinataire-tel"
                  type="tel"
                  className="h-11"
                  value={colis.destinataireTel}
                  onChange={(e) => colis.setDestinataireTel(e.target.value)}
                  required
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="destinataire-id">Pièce d&apos;identité</FieldLabel>
                <Input
                  id="destinataire-id"
                  className="h-11"
                  value={colis.destinataireId}
                  onChange={(e) => colis.setDestinataireId(e.target.value)}
                  placeholder="N° carte / passeport"
                  required
                />
                <FieldDescription>
                  Personne autorisée à récupérer le colis à l&apos;arrivée.
                </FieldDescription>
              </Field>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
