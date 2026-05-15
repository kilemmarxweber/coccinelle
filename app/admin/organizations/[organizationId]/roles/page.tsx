"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ALL_ORG_ROLE_SLUGS, organizationRoleStatements } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function OrganizationRolesPage() {
  const params = useParams();
  const organizationId = params.organizationId as string;

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-8 md:max-w-4xl md:px-6">
      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
        Grille des rôles définis dans l’application (Better Auth · contrôle d’accès). Les
        modifications avancées des presets se font côté configuration serveur (
        <code className="break-all rounded bg-muted px-1 py-0.5 text-xs">lib/permissions.ts</code>
        ).
      </p>

      <div className="flex flex-col gap-8">
        {ALL_ORG_ROLE_SLUGS.map((slug) => {
          const statements = organizationRoleStatements[slug];
          return (
            <section key={slug} className="flex flex-col gap-4">
              <div className="space-y-1">
                <h2 className="text-base font-semibold leading-snug">{orgRoleLabel(slug)}</h2>
                <p className="break-all font-mono text-xs leading-relaxed text-muted-foreground">
                  slug · {slug}
                </p>
              </div>
              <div className="flex flex-col gap-4">
                {statements &&
                  Object.entries(statements).map(([resource, actions]) => {
                    const list = actions as readonly string[] | undefined;
                    if (!list?.length) return null;
                    return (
                      <div key={`${slug}-${resource}`} className="flex min-w-0 flex-col gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {resource}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {list.map((action) => (
                            <Badge
                              key={action}
                              variant="secondary"
                              className="max-w-full shrink-0 wrap-break-word px-2 py-1 text-left font-normal leading-snug"
                            >
                              {action}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </section>
          );
        })}
      </div>

      <Button
        variant="ghost"
        className="h-11 min-h-[44px] w-full touch-manipulation sm:w-fit sm:px-3"
        render={<Link href={`/admin/organizations/${organizationId}`} />}
      >
        ← Accueil organisation
      </Button>
    </div>
  );
}
