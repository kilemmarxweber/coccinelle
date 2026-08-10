import Link from "next/link";
import { headers } from "next/headers";
import { BedDouble, LogIn } from "lucide-react";
import { auth } from "@/lib/auth";
import { clientHotelRoutes } from "@/lib/branch/paths";

type Props = {
  orgSlug: string;
  hotelName: string;
};

/** Header public hôtel — Accueil / Mes séjours / Connexion (pas Mes billets / Plane). */
export async function HotelPublicHeader({ orgSlug, hotelName }: Props) {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <header className="sticky top-0 z-40 -mx-4 mb-6 border-b border-border/80 bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80 sm:-mx-6 sm:px-6">
      <nav
        className="flex h-14 flex-wrap items-center justify-between gap-3"
        aria-label="Navigation hôtel"
      >
        <Link
          href={clientHotelRoutes.root(orgSlug)}
          className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground transition hover:text-primary"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BedDouble className="size-4" aria-hidden />
          </span>
          <span className="truncate">{hotelName}</span>
        </Link>

        <div className="flex flex-wrap items-center gap-1">
          <Link
            href={clientHotelRoutes.root(orgSlug)}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Accueil
          </Link>
          <Link
            href={clientHotelRoutes.mesSejours(orgSlug)}
            className="rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            Mes séjours
          </Link>
          {session?.user ? null : (
            <Link
              href={clientHotelRoutes.connexion(orgSlug)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/10"
            >
              <LogIn className="size-3.5" aria-hidden />
              Connexion
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
