import Image from "next/image";
import Link from "next/link";
import { headers } from "next/headers";
import { Plane } from "lucide-react";
import { auth } from "@/lib/auth";
import type { PublicOrganization } from "@/lib/pwa/org";
import { OrgBrandHeaderActions } from "@/components/pwa/org-brand-header-actions";

export async function OrgBrandHeader({ org }: { org: PublicOrganization }) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4 sm:h-16">
        <Link
          href={`/${org.slug}`}
          className="flex min-w-0 flex-1 items-center gap-3"
          aria-label={`${org.name} — accueil`}
        >
          {org.logo ? (
            <Image
              src={org.logo}
              alt=""
              width={36}
              height={36}
              className="size-9 rounded-lg object-cover"
              unoptimized
            />
          ) : (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Plane className="size-4" aria-hidden />
            </span>
          )}
          <span className="truncate text-lg font-bold tracking-tight text-foreground sm:text-xl">
            {org.name}
          </span>
        </Link>
        <OrgBrandHeaderActions
          orgSlug={org.slug}
          isSignedIn={Boolean(session?.user)}
        />
      </div>
    </header>
  );
}
