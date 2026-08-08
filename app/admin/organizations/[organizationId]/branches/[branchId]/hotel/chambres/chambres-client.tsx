"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { BedDouble } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDataTable } from "@/components/data-table/responsive-data-table";
import { updateRoomStatusAction } from "@/lib/hotel/actions";
import { cn } from "@/lib/utils";

const STATUSES = [
  {
    value: "AVAILABLE",
    label: "Libre",
    className: "bg-emerald-500/15 text-emerald-600",
  },
  {
    value: "OCCUPIED",
    label: "Occupée",
    className: "bg-sky-500/15 text-sky-600",
  },
  {
    value: "CLEANING",
    label: "Ménage",
    className: "bg-muted text-muted-foreground",
  },
  {
    value: "OUT_OF_ORDER",
    label: "HS",
    className: "bg-rose-500/15 text-rose-600",
  },
] as const;

type Room = {
  id: string;
  number: string;
  floor: string | null;
  status: string;
  roomType: { name: string; priceNight: number; capacity: number };
};

export function ChambresClient(props: {
  organizationId: string;
  branchId: string;
  rooms: Room[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function setStatus(
    roomId: string,
    status: (typeof STATUSES)[number]["value"],
  ) {
    start(async () => {
      try {
        await updateRoomStatusAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          roomId,
          status,
        });
        toast.success("Statut mis à jour");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const columns = useMemo<ColumnDef<Room>[]>(
    () => [
      {
        accessorKey: "number",
        header: "Chambre",
        cell: ({ row }) => (
          <span className="font-semibold">Ch. {row.original.number}</span>
        ),
      },
      {
        id: "type",
        header: "Type",
        cell: ({ row }) => row.original.roomType.name,
      },
      {
        id: "capacity",
        header: "Capacité",
        cell: ({ row }) => `${row.original.roomType.capacity} pers.`,
      },
      {
        id: "price",
        header: "Tarif",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.roomType.priceNight.toFixed(2)} $/nuit
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: "Statut",
        cell: ({ row }) => {
          const meta =
            STATUSES.find((s) => s.value === row.original.status) ??
            STATUSES[0];
          return (
            <Badge
              variant="outline"
              className={cn("border-transparent", meta.className)}
            >
              {meta.label}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1" data-no-row-nav="true">
            {STATUSES.map((s) => (
              <Button
                key={s.value}
                size="xs"
                variant={
                  row.original.status === s.value ? "default" : "outline"
                }
                disabled={pending || row.original.status === s.value}
                onClick={() => setStatus(row.original.id, s.value)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending],
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-500">
          <BedDouble className="size-6" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Chambres</h1>
          <p className="text-sm text-muted-foreground">
            Inventaire et statuts ménage / occupation.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <ResponsiveDataTable
          columns={columns}
          data={props.rooms}
          emptyText="Aucune chambre."
          pageSize={20}
          mobileCardTitle={(row) => `Chambre ${row.number}`}
          mobileCardSubtitle={(row) =>
            `${row.roomType.name} · ${row.roomType.priceNight.toFixed(2)} $/nuit`
          }
          mobileCardBadges={(row) => {
            const meta =
              STATUSES.find((s) => s.value === row.status) ?? STATUSES[0];
            return [{ label: meta.label, variant: "secondary" }];
          }}
          mobileCardActions={(row) => (
            <>
              {STATUSES.map((s) => (
                <Button
                  key={s.value}
                  size="xs"
                  variant={row.status === s.value ? "default" : "outline"}
                  disabled={pending || row.status === s.value}
                  onClick={() => setStatus(row.id, s.value)}
                >
                  {s.label}
                </Button>
              ))}
            </>
          )}
        />
      </section>
    </div>
  );
}
