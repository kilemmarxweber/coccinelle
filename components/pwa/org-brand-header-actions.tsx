"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Ticket } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export function OrgBrandHeaderActions({
  orgSlug,
  isSignedIn,
}: {
  orgSlug: string;
  isSignedIn: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isAffiliePortal = pathname.includes("/usine-affilie");

  async function handleSignOut() {
    await authClient.signOut();
    router.replace(`/auth/sign-in?callbackUrl=${encodeURIComponent(`/${orgSlug}/usine-affilie`)}`);
    router.refresh();
  }

  if (!isSignedIn) return null;

  if (isAffiliePortal) {
    return (
      <button
        type="button"
        onClick={() => void handleSignOut()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
      >
        <LogOut className="size-4" aria-hidden />
        <span className="hidden sm:inline">Déconnexion</span>
      </button>
    );
  }

  return (
    <Link
      href={`/${orgSlug}/mes-reservations`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground",
      )}
    >
      <Ticket className="size-4" aria-hidden />
      <span className="hidden sm:inline">Mes billets</span>
    </Link>
  );
}
