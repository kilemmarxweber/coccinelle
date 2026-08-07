"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { BedDouble } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { updateRoomStatusAction } from "@/lib/hotel/actions";
import { cn } from "@/lib/utils";

const STATUSES = [
  { value: "AVAILABLE", label: "Libre", className: "bg-emerald-500/15 text-emerald-600" },
  { value: "OCCUPIED", label: "Occupée", className: "bg-sky-500/15 text-sky-600" },
  { value: "CLEANING", label: "Ménage", className: "bg-muted text-muted-foreground" },
  { value: "OUT_OF_ORDER", label: "HS", className: "bg-rose-500/15 text-rose-600" },
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

  function setStatus(roomId: string, status: (typeof STATUSES)[number]["value"]) {
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
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

      <div className="grid gap-3 sm:grid-cols-2">
        {props.rooms.map((r) => {
          const meta = STATUSES.find((s) => s.value === r.status) ?? STATUSES[0];
          return (
            <div
              key={r.id}
              className="rounded-2xl border border-border bg-card p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">Chambre {r.number}</p>
                  <p className="text-sm text-muted-foreground">
                    {r.roomType.name} · {r.roomType.capacity} pers. ·{" "}
                    {r.roomType.priceNight}/nuit
                    {r.floor ? ` · ét. ${r.floor}` : ""}
                  </p>
                </div>
                <Badge className={cn("border-0", meta.className)}>
                  {meta.label}
                </Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <Button
                    key={s.value}
                    size="xs"
                    variant={r.status === s.value ? "default" : "outline"}
                    disabled={pending}
                    onClick={() => setStatus(r.id, s.value)}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
