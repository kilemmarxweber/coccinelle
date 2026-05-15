"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { SidebarMenuButton } from "@/components/ui/sidebar";

function getUserDisplayName(name?: string | null, email?: string | null) {
  if (name?.trim()) {
    return name.trim();
  }

  if (email?.includes("@")) {
    return email.split("@")[0];
  }

  return "User";
}

export function UserMenu() {
  const { data: session } = authClient.useSession();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const user = session?.user;

  if (!user) {
    return null;
  }

  const displayName = getUserDisplayName(user.name, user.email);
  const email = user.email ?? "";
  const fallbackInitial = (displayName || email || "U").charAt(0).toUpperCase();

  const handleSignOut = () => {
    startTransition(async () => {
      await authClient.signOut({
        fetchOptions: {
          onSuccess: () => {
            router.push("/auth/sign-in");
            router.refresh();
          },
          onError: ({ error }) => {
            toast.error(error?.message ?? "Could not sign out.");
          },
        },
      });
    });
  };

  return (
    <Popover>
      <PopoverTrigger
        render={<SidebarMenuButton size="lg" className="h-auto min-h-12" />}
      >
        <Avatar className="size-8 rounded-lg">
          <AvatarFallback className="rounded-lg">{fallbackInitial}</AvatarFallback>
        </Avatar>
        <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
          <span className="truncate font-medium">{displayName}</span>
          <span className="truncate text-xs text-sidebar-foreground/70">{email}</span>
        </div>
        <ChevronsUpDown className="ml-auto size-4" />
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-56 p-1">
        <div className="flex items-center gap-2 rounded-sm px-2 py-1.5">
          <Avatar className="size-8 rounded-lg">
            <AvatarFallback className="rounded-lg">{fallbackInitial}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 text-sm">
            <p className="truncate font-medium">{displayName}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <Separator />
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={handleSignOut}
          disabled={isPending}
        >
          <LogOut />
          {isPending ? "Signing out…" : "Log out"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
