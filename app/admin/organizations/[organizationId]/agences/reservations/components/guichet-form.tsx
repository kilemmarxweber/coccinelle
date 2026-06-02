"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GuichetClientSection } from "./guichet/guichet-client-section";
import { GuichetColisSection } from "./guichet/guichet-colis-section";
import { GuichetPassagersSection } from "./guichet/guichet-passagers-section";
import { GuichetPaiementSelect } from "./guichet/guichet-paiement-select";
import { GuichetRecap } from "./guichet/guichet-recap";
import { GuichetTrajetSection } from "./guichet/guichet-trajet-section";
import { useGuichetForm } from "./guichet/use-guichet-form";
import type { GuichetFormProps } from "./guichet/types";

export type { GuichetFormProps, TrajetOption } from "./guichet/types";

export function GuichetForm(props: GuichetFormProps) {
  const form = useGuichetForm(props);

  return (
    <div className="min-h-screen">
      <PageHeader title="Guichet" subtitle="Nouvelle réservation" showBack />

      <form
        onSubmit={form.handleSubmit}
        className="mx-auto grid w-full max-w-2xl gap-6 px-4 py-4 md:max-w-6xl md:grid-cols-[1fr_320px] md:px-6 lg:grid-cols-[1fr_360px]"
      >
        <div className="min-w-0 space-y-6">
          <GuichetClientSection form={form} />
          <GuichetTrajetSection form={form} />
          <GuichetPassagersSection form={form} />
          <GuichetColisSection form={form} />
          <Card className="md:hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Paiement</CardTitle>
            </CardHeader>
            <CardContent>
              <GuichetPaiementSelect
                value={form.paiement.mode}
                onChange={form.paiement.setMode}
              />
            </CardContent>
          </Card>
        </div>
        <GuichetRecap form={form} />
      </form>
    </div>
  );
}
