"use client";

import Link from "next/link";
import { Building2, Plane, Shield } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { isAppAdminRole } from "@/lib/permissions";

/** Accueil admin plateforme — pas de métier transport ici (U18). */
export default function AdminPage() {
  const { data: session, isPending } = useSession();
  const name = session?.user?.name ?? "…";
  const isPlatformAdmin = isAppAdminRole(session?.user?.role);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:max-w-4xl md:px-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Plane className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 space-y-1">
          <h1 className="text-xl font-semibold tracking-tight">
            Coccinelle — Plateforme
          </h1>
          <p className="text-sm text-muted-foreground">
            {isPending
              ? "Chargement…"
              : `Connecté en tant que ${name}${isPlatformAdmin ? " (super-admin)" : ""}.`}
          </p>
        </div>
      </div>

      <p className="text-base text-foreground">
        Espace administration multi-organisations. Le pilotage métier (trajets,
        ventes, embarquement) se fait dans chaque agence.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="size-4 text-primary" />
              Organisations
            </CardTitle>
            <CardDescription>
              Créer et superviser les agences Coccinelle.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-4">
            <Button
              render={<Link href="/admin/organizations" />}
              className="w-full"
            >
              Gérer les organisations
            </Button>
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="size-4 text-primary" />
              Compte
            </CardTitle>
            <CardDescription>
              Profil et paramètres de votre session.
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-4">
            <Button
              variant="outline"
              render={<Link href="/admin/account" />}
              className="w-full"
            >
              Mon compte
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
