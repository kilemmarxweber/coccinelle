"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { APP_ROLE } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { ListGroup, ListItem } from "@/components/ui/list-item";
import { EmptyState } from "@/components/ui/empty-state";

export default function AdminOrganizationsPage() {
  const { data: session } = authClient.useSession();
  const { data: orgsData, isPending } = authClient.useListOrganizations();
  const orgs = Array.isArray(orgsData) ? orgsData : [];
  const canCreateOrganization = session?.user?.role === APP_ROLE.ADMIN;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-4 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] md:max-w-4xl md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {isPending ? "Chargement…" : `${orgs.length} organisation${orgs.length > 1 ? "s" : ""}`}
        </p>
        {canCreateOrganization ? (
          <Button
            size="sm"
            className="h-11 min-h-[44px] gap-1.5 touch-manipulation sm:h-9 sm:min-h-0"
            render={<Link href="/admin/organizations/new" />}
          >
            <Plus className="size-4" />
            Créer
          </Button>
        ) : null}
      </div>

      {orgs.length === 0 && !isPending ? (
        <EmptyState
          title="Aucune organisation"
          description="Créez votre premier espace pour inviter des membres et centraliser la gestion."
          action={
            canCreateOrganization ? (
              <Button render={<Link href="/admin/organizations/new" />}>Créer une organisation</Button>
            ) : undefined
          }
        />
      ) : (
        <ListGroup>
          {orgs.map((org) => (
            <ListItem
              key={org.id}
              title={org.name}
              subtitle={org.slug}
              href={`/admin/organizations/${org.id}`}
              showChevron
            />
          ))}
        </ListGroup>
      )}
    </div>
  );
}
