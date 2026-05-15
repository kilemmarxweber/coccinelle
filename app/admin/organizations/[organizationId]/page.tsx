"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { CirclePile, Shield, Users, School } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function AdminOrganizationHomePage() {
  const params = useParams();
  const id = params.organizationId as string;
  const { data: orgs, isPending } = authClient.useListOrganizations();
  const list = Array.isArray(orgs) ? orgs : [];
  const org = list.find((o) => o.id === id);
  const base = `/admin/organizations/${id}`;

  if (!isPending && !org) {
    return (
      <div className="mx-auto max-w-2xl px-[max(1rem,env(safe-area-inset-left))] py-8 pr-[max(1rem,env(safe-area-inset-right))] md:max-w-4xl md:px-6">
        <p className="text-muted-foreground">Organisation introuvable.</p>
        <Button className="mt-4" variant="outline" render={<Link href="/admin/organizations" />}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-8 md:max-w-4xl md:px-6">
      {isPending ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <p className="break-all text-xs text-muted-foreground">Slug · {org?.slug}</p>
            <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
              Utilisez le menu ci-dessus pour gérer les membres et les rôles de cette organisation.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Button
              render={<Link href={`${base}/ecodim`} />}
              variant="outline"
              className="h-auto min-h-22 w-full touch-manipulation justify-start gap-0 p-4 text-left sm:min-h-24"
            >
              <div className="flex min-w-0 flex-col gap-2 text-left">
                <School className="size-7 shrink-0 text-primary sm:size-6" aria-hidden />
                <span className="text-base font-semibold leading-snug">Ecodim</span>
                <span className="text-pretty text-sm font-normal leading-relaxed text-muted-foreground">
                  Gérer l'ecole du dimanche.
                </span>
              </div>
            </Button>

            <Button
              render={<Link href={`${base}/members`} />}
              variant="outline"
              className="h-auto min-h-22 w-full touch-manipulation justify-start gap-0 p-4 text-left sm:min-h-24"
            >
              <div className="flex min-w-0 flex-col gap-2 text-left">
                <Users className="size-7 shrink-0 text-primary sm:size-6" aria-hidden />
                <span className="text-base font-semibold leading-snug">Membres</span>
                <span className="text-pretty text-sm font-normal leading-relaxed text-muted-foreground">
                  Créer un compte et l’ajouter comme membre, ou modifier les membres existants.
                </span>
              </div>
            </Button>

            <Button
              render={<Link href={`${base}/roles`} />}
              variant="outline"
              className="h-auto min-h-22 w-full touch-manipulation justify-start gap-0 p-4 text-left sm:min-h-24"
            >
              <div className="flex min-w-0 flex-col gap-2 text-left">
                <Shield className="size-7 shrink-0 text-primary sm:size-6" aria-hidden />
                <span className="text-base font-semibold leading-snug">Rôles & permissions</span>
                <span className="text-pretty text-sm font-normal leading-relaxed text-muted-foreground">
                  Vue des rôles métier et des droits associés.
                </span>
              </div>
            </Button>

            <Button
              render={<Link href={`${base}/Families`} />}
              variant="outline"
              className="h-auto min-h-22 w-full touch-manipulation justify-start gap-0 p-4 text-left sm:min-h-24"
            >
              <div className="flex min-w-0 flex-col gap-2 text-left">
                <CirclePile className="size-7 shrink-0 text-primary sm:size-6" aria-hidden />
                <span className="text-base font-semibold leading-snug">Familles</span>
                <span className="text-pretty text-sm font-normal leading-relaxed text-muted-foreground">
                  Gérer les familles de l'eglise.
                </span>
              </div>
            </Button>

          </div>

          <Button
            variant="ghost"
            className="h-11 min-h-[44px] w-full touch-manipulation sm:w-fit sm:px-3"
            render={<Link href="/admin/organizations" />}
          >
            ← Toutes les organisations
          </Button>
        </>
      )}
    </div>
  );
}
