"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  ClipboardList,
  Home,
  LayoutDashboard,
  LogOut,
  Settings,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { isAppAdminRole } from "@/lib/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ecodimNavItems: NavItem[] = [
  { href: "/ecodim", label: "Accueil", icon: Home },
  { href: "/ecodim/enfants", label: "Enfants", icon: Users },
  { href: "/ecodim/classes", label: "Classes", icon: BookOpen },
  { href: "/ecodim/presence", label: "Presence", icon: ClipboardList },
];

function getUserDisplayName(name?: string | null, email?: string | null) {
  if (name?.trim()) return name.trim();
  if (email?.includes("@")) return email.split("@")[0];
  return "Utilisateur";
}

function getUserInitials(name?: string | null, email?: string | null) {
  const display = getUserDisplayName(name, email);
  const parts = display.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  return display.charAt(0).toUpperCase();
}

function resolveEcodimBasePath(pathname: string, organizationId?: string | null): string {
  const fromPath = pathname.match(/^(\/admin\/organizations\/[^/]+\/ecodim)/)?.[1];
  if (fromPath) return fromPath;
  if (organizationId) return `/admin/organizations/${organizationId}/ecodim`;
  return "/ecodim";
}

function MobileNavMoreMenu() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();
  const user = session?.user;

  const moreActive =
    pathname.startsWith("/admin/account") || pathname.startsWith("/admin/settings");

  const initials = getUserInitials(user?.name, user?.email);

  async function handleSignOut() {
    try {
      await authClient.signOut();
      router.push("/auth/sign-in");
      router.refresh();
    } catch {
      toast.error("Déconnexion impossible.");
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Menu compte"
        className={cn(
          "flex min-h-[60px] flex-1 items-center justify-center px-2 py-3 transition-colors",
          "touch-manipulation active:bg-muted/50",
          "border-0 bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      >
        <Avatar
          className={cn(
            "size-9 ring-2 ring-transparent",
            moreActive && "ring-primary/40",
          )}
        >
          {user?.image ? (
            <AvatarImage src={user.image} alt={getUserDisplayName(user.name, user.email)} />
          ) : null}
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
            {initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" side="top" sideOffset={8} className="min-w-48">
        <DropdownMenuItem
          className="min-h-10 cursor-pointer"
          onClick={() => router.push("/admin/account")}
        >
          <User className="size-4" />
          Compte
        </DropdownMenuItem>
        <DropdownMenuItem
          className="min-h-10 cursor-pointer"
          onClick={() => router.push("/admin/settings")}
        >
          <Settings className="size-4" />
          Paramètres
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          className="min-h-10 cursor-pointer"
          onClick={() => void handleSignOut()}
        >
          <LogOut className="size-4" />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function EcodimMobileNav() {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  const navItems = useMemo(() => {
    const base = resolveEcodimBasePath(pathname, session?.organization?.id);
    return ecodimNavItems.map((item) => ({
      ...item,
      href: item.href.replace("/ecodim", base),
    }));
  }, [pathname, session?.organization?.id]);

  return (
    <div className="flex flex-1 items-stretch justify-around">
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-2 py-3 transition-colors",
              "touch-manipulation active:bg-muted/50",
              isActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className={cn("size-5", isActive && "stroke-[2.5px]")} />
            <span
              className={cn(
                "text-[10px] font-medium leading-none",
                isActive && "font-semibold",
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
      <MobileNavMoreMenu />
    </div>
  );
}

function AdminMobileNav() {
  const pathname = usePathname();

  const homeActive = pathname === "/admin";
  const orgActive = pathname.startsWith("/admin/organizations");

  return (
    <div className="flex flex-1 items-stretch justify-around">
      <Link
        href="/admin"
        className={cn(
          "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-2 py-3 transition-colors",
          "touch-manipulation active:bg-muted/50",
          homeActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <LayoutDashboard className={cn("size-5", homeActive && "stroke-[2.5px]")} />
        <span
          className={cn(
            "text-[10px] font-medium leading-none",
            homeActive && "font-semibold",
          )}
        >
          Accueil
        </span>
      </Link>

      <Link
        href="/admin/organizations"
        className={cn(
          "flex min-h-[60px] flex-1 flex-col items-center justify-center gap-1 px-2 py-3 transition-colors",
          "touch-manipulation active:bg-muted/50",
          orgActive ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Building2 className={cn("size-5", orgActive && "stroke-[2.5px]")} />
        <span
          className={cn(
            "text-[10px] font-medium leading-none",
            orgActive && "font-semibold",
          )}
        >
          Organisations
        </span>
      </Link>

      <MobileNavMoreMenu />
    </div>
  );
}

export function MobileNav() {
  const { data: session, isPending } = authClient.useSession();
  const showAdminNav = isAppAdminRole(session?.user?.role);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden safe-area-bottom">
      {isPending ? (
        <div className="min-h-[60px] flex-1" aria-hidden />
      ) : showAdminNav ? (
        <AdminMobileNav />
      ) : (
        <EcodimMobileNav />
      )}
    </nav>
  );
}
