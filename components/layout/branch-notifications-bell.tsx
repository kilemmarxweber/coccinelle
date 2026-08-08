"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BedDouble, ChefHat, CircleDollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  getBranchAlertFeedAction,
  markNotificationsReadAction,
} from "@/lib/hotel/actions";
import { caisseRoutes, hotelRoutes } from "@/lib/branch/paths";
import { cn } from "@/lib/utils";

type Notif = {
  id: string;
  title: string;
  body: string;
  kind: string;
  href: string | null;
  readAt: string | Date | null;
  createdAt: string | Date;
};

type Feed = {
  notifications: Notif[];
  unreadCount: number;
  attention: number;
  ops: {
    kitchenOrders: number;
    readyOrders: number;
    arrivals: number;
    departures: number;
  };
};

function relativeTime(value: string | Date) {
  const d = new Date(value).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "à l’instant";
  if (m < 60) return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h} h`;
  return new Date(value).toLocaleString("fr-FR");
}

export function BranchNotificationsBell(props: {
  organizationId: string;
  branchId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [feed, setFeed] = useState<Feed | null>(null);

  const load = useCallback(() => {
    start(async () => {
      try {
        const next = await getBranchAlertFeedAction(
          props.organizationId,
          props.branchId,
        );
        setFeed(next);
      } catch {
        /* ignore poll errors */
      }
    });
  }, [props.organizationId, props.branchId]);

  useEffect(() => {
    load();
    const id = window.setInterval(load, 8000);
    return () => window.clearInterval(id);
  }, [load]);

  function markAllRead() {
    start(async () => {
      try {
        await markNotificationsReadAction(
          props.organizationId,
          props.branchId,
        );
        load();
      } catch {
        /* ignore */
      }
    });
  }

  const attention = feed?.attention ?? 0;
  const unread = feed?.unreadCount ?? 0;
  const animate = attention > 0;

  const ops = feed?.ops;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="relative"
            aria-label="Notifications"
          />
        }
      >
        <Bell className={cn("size-4", animate && "animate-bell-ring text-primary")} />
        {unread > 0 ? (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : animate ? (
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary" />
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(100vw-2rem,22rem)] gap-0 p-0">
        <PopoverHeader className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <PopoverTitle>Notifications</PopoverTitle>
              <PopoverDescription>
                Commandes, check-in / check-out
              </PopoverDescription>
            </div>
            {pending ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>
        </PopoverHeader>

        {ops ? (
          <div className="grid grid-cols-2 gap-2 border-b border-border bg-muted/30 p-3">
            <Link
              href={hotelRoutes.cuisine(props.organizationId, props.branchId)}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition hover:border-primary/40"
            >
              <ChefHat className="size-4 text-orange-500" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Cuisine</span>
                <span className="font-semibold tabular-nums">
                  {ops.kitchenOrders}
                </span>
              </span>
            </Link>
            <Link
              href={caisseRoutes.root(props.organizationId, props.branchId)}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition hover:border-primary/40"
            >
              <CircleDollarSign className="size-4 text-emerald-500" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">F&B</span>
                <span className="font-semibold tabular-nums">
                  {ops.readyOrders}
                </span>
              </span>
            </Link>
            <Link
              href={hotelRoutes.sejours(props.organizationId, props.branchId)}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition hover:border-primary/40"
            >
              <BedDouble className="size-4 text-sky-500" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Arrivées</span>
                <span className="font-semibold tabular-nums">{ops.arrivals}</span>
              </span>
            </Link>
            <Link
              href={hotelRoutes.sejours(props.organizationId, props.branchId)}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-2 text-left transition hover:border-primary/40"
            >
              <BedDouble className="size-4 text-rose-500" />
              <span className="min-w-0">
                <span className="block text-xs text-muted-foreground">Départs</span>
                <span className="font-semibold tabular-nums">
                  {ops.departures}
                </span>
              </span>
            </Link>
          </div>
        ) : null}

        <div className="max-h-72 overflow-auto">
          {(feed?.notifications.length ?? 0) === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              Aucune notification.
            </p>
          ) : (
            feed!.notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b border-border px-4 py-3 text-left transition hover:bg-muted/50",
                  !n.readAt && "bg-primary/5",
                )}
                onClick={() => {
                  setOpen(false);
                  start(async () => {
                    await markNotificationsReadAction(
                      props.organizationId,
                      props.branchId,
                      [n.id],
                    );
                    if (n.href) router.push(n.href);
                    load();
                  });
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold">{n.title}</span>
                  {!n.readAt ? (
                    <span className="size-1.5 shrink-0 rounded-full bg-primary" />
                  ) : null}
                </span>
                <span className="line-clamp-2 text-xs text-muted-foreground">
                  {n.body}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {relativeTime(n.createdAt)}
                </span>
              </button>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={unread === 0 || pending}
            onClick={markAllRead}
          >
            Tout marquer lu
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpen(false);
              load();
              router.refresh();
            }}
          >
            Actualiser
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
