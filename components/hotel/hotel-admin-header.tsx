"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GitBranch, LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { organizationBranchesPath } from "@/lib/branch/paths";

type HotelAdminHeaderProps = {
  organizationId: string;
  branchName: string;
};

export function HotelAdminHeader({
  organizationId,
  branchName,
}: HotelAdminHeaderProps) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/auth/sign-in");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {branchName}
        </p>
        <p className="truncate text-[10px] tracking-wide text-muted-foreground uppercase">
          HOTEL
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <ThemeToggle />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="hidden gap-1.5 sm:inline-flex"
          render={<Link href={organizationBranchesPath(organizationId)} />}
        >
          <GitBranch className="size-3.5" />
          Branches
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={signingOut}
          onClick={() => void handleSignOut()}
          className="gap-1.5"
        >
          <LogOut className="size-3.5" />
          <span className="hidden sm:inline">
            {signingOut ? "…" : "Déconnexion"}
          </span>
        </Button>
      </div>
    </header>
  );
}
