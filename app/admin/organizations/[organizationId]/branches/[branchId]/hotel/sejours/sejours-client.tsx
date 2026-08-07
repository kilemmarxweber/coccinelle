"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  checkInStayAction,
  checkOutStayAction,
  createStayAction,
} from "@/lib/hotel/actions";
import { branchCaissePath } from "@/lib/branch/paths";
import { cn } from "@/lib/utils";

type Room = {
  id: string;
  number: string;
  status: string;
  roomType: { name: string; priceNight: number };
};

type Stay = {
  id: string;
  guestName: string;
  checkInDate: string | Date;
  checkOutDate: string | Date;
  status: string;
  roomId: string;
  room: { number: string; roomType: { name: string } };
  folio: { id: string; lines: { amount: number }[]; payments?: { amountCdf: number }[] } | null;
};

type YearStay = {
  id: string;
  checkInDate: string | Date;
  checkOutDate: string | Date;
  status: string;
  roomId: string;
};

const MONTHS = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function SejoursClient(props: {
  organizationId: string;
  branchId: string;
  rooms: Room[];
  stays: Stay[];
  yearStays: YearStay[];
  initialYear: number;
  initialMonth: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [year, setYear] = useState(props.initialYear);
  const [month, setMonth] = useState(props.initialMonth);
  const [view, setView] = useState<"month" | "year">("month");
  const [form, setForm] = useState({
    roomId: props.rooms[0]?.id ?? "",
    guestName: "",
    guestPhone: "",
    checkInDate: "",
    checkOutDate: "",
  });

  const todayKey = toDateKey(new Date());
  const dim = daysInMonth(year, month);
  const dayCols = useMemo(
    () => Array.from({ length: dim }, (_, i) => i + 1),
    [dim],
  );

  function navigate(y: number, m: number) {
    setYear(y);
    setMonth(m);
    router.push(
      `?year=${y}&month=${m}`,
    );
    router.refresh();
  }

  function stayStyle(stay: Stay, day: number) {
    const start = new Date(stay.checkInDate);
    const end = new Date(stay.checkOutDate);
    const cell = new Date(Date.UTC(year, month - 1, day));
    if (cell < start || cell >= end) return null;

    const key = toDateKey(cell);
    const outKey = toDateKey(end);
    const inKey = toDateKey(start);
    const isCheckoutDay = key === outKey || (key < outKey && day === dim && end > cell);
    // Checkout day = last night ends morning of checkout — paint checkout date cell red when cell is checkout date-1... Plan says checkout day in red. Use checkOutDate day as red marker on the day before or on checkout date. We'll mark the checkout date column as red tip.
    const isOut = toDateKey(new Date(Date.UTC(year, month - 1, day))) === outKey;
    const isIn = key === inKey;

    if (isOut) return "bg-red-500 text-white";
    if (isIn) return "bg-orange-500 text-white";
    if (stay.status === "CHECKED_IN") return "bg-sky-500/80 text-white";
    return "bg-sky-500/40 text-foreground";
  }

  function create() {
    start(async () => {
      try {
        await createStayAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          ...form,
        });
        toast.success("Séjour réservé");
        setForm((f) => ({ ...f, guestName: "", guestPhone: "" }));
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function checkIn(stayId: string) {
    start(async () => {
      try {
        await checkInStayAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          stayId,
        });
        toast.success("Check-in effectué");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function checkOut(stayId: string) {
    start(async () => {
      try {
        const res = await checkOutStayAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          stayId,
        });
        if (!res.ok && res.needsPayment) {
          toast.message(`Solde ${res.balance.toFixed(2)} — allez à la caisse`);
          router.push(branchCaissePath(props.organizationId, props.branchId));
          return;
        }
        toast.success("Check-out effectué");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const occupancyByMonth = useMemo(() => {
    return MONTHS.map((_, mi) => {
      const start = new Date(Date.UTC(year, mi, 1));
      const end = new Date(Date.UTC(year, mi + 1, 1));
      const nights = props.yearStays.reduce((acc, s) => {
        const a = new Date(s.checkInDate);
        const b = new Date(s.checkOutDate);
        const from = a > start ? a : start;
        const to = b < end ? b : end;
        if (to <= from) return acc;
        return acc + Math.ceil((to.getTime() - from.getTime()) / 86400000);
      }, 0);
      const capacity = props.rooms.length * daysInMonth(year, mi + 1);
      return capacity ? Math.round((nights / capacity) * 100) : 0;
    });
  }, [props.yearStays, props.rooms.length, year]);

  return (
    <div className="mx-auto max-w-[100vw] space-y-6 px-4 py-6 lg:max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Séjours</h1>
          <p className="text-sm text-muted-foreground">
            Planning chambres · checkout du jour en{" "}
            <span className="font-semibold text-red-500">rouge</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={view === "month" ? "default" : "outline"}
            onClick={() => setView("month")}
          >
            Mois
          </Button>
          <Button
            size="sm"
            variant={view === "year" ? "default" : "outline"}
            onClick={() => setView("year")}
          >
            Année
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(year - 1, month)}
          >
            ← An
          </Button>
          <select
            className="h-8 rounded-md border border-border bg-background px-2 text-sm"
            value={month}
            onChange={(e) => navigate(year, Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <Input
            type="number"
            className="h-8 w-24"
            value={year}
            onChange={(e) => navigate(Number(e.target.value) || year, month)}
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate(year + 1, month)}
          >
            An →
          </Button>
        </div>
      </div>

      {view === "year" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {MONTHS.map((m, i) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setView("month");
                navigate(year, i + 1);
              }}
              className="rounded-xl border border-border bg-card p-4 text-left transition hover:border-primary/40"
            >
              <p className="text-sm font-semibold">{m}</p>
              <p className="mt-2 text-2xl font-bold text-primary">
                {occupancyByMonth[i]}%
              </p>
              <p className="text-xs text-muted-foreground">occupation</p>
            </button>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="min-w-max w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/90 px-3 py-2 text-left font-semibold">
                  Chambre
                </th>
                {dayCols.map((d) => {
                  const key = toDateKey(new Date(Date.UTC(year, month - 1, d)));
                  const isToday = key === todayKey;
                  return (
                    <th
                      key={d}
                      className={cn(
                        "w-9 px-0.5 py-2 text-center font-medium",
                        isToday && "bg-primary/15 text-primary",
                      )}
                    >
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {props.rooms.map((room) => {
                const roomStays = props.stays.filter((s) => s.roomId === room.id);
                return (
                  <tr key={room.id} className="border-b border-border/60">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium whitespace-nowrap">
                      {room.number}
                      <span className="block text-[10px] text-muted-foreground">
                        {room.roomType.name}
                      </span>
                    </td>
                    {dayCols.map((d) => {
                      const covering = roomStays.find((s) => {
                        const start = new Date(s.checkInDate);
                        const end = new Date(s.checkOutDate);
                        const cell = new Date(Date.UTC(year, month - 1, d));
                        return cell >= start && cell < end;
                      });
                      const style = covering
                        ? stayStyle(covering, d)
                        : "bg-emerald-500/10";
                      const outKey = covering
                        ? toDateKey(new Date(covering.checkOutDate))
                        : "";
                      const cellKey = toDateKey(
                        new Date(Date.UTC(year, month - 1, d)),
                      );
                      const isCheckoutMarker = covering && cellKey === outKey;
                      return (
                        <td key={d} className="p-0.5">
                          <div
                            title={
                              covering
                                ? `${covering.guestName} (${covering.status})`
                                : "Libre"
                            }
                            className={cn(
                              "flex h-8 items-center justify-center rounded-sm",
                              isCheckoutMarker
                                ? "bg-red-500 text-[9px] font-bold text-white"
                                : style,
                            )}
                          >
                            {covering && cellKey === toDateKey(new Date(covering.checkInDate))
                              ? covering.guestName.slice(0, 2)
                              : isCheckoutMarker
                                ? "OUT"
                                : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
          <h2 className="font-semibold">Nouvelle réservation</h2>
          <div className="grid gap-1.5">
            <Label>Chambre</Label>
            <select
              className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              value={form.roomId}
              onChange={(e) => setForm((f) => ({ ...f, roomId: e.target.value }))}
            >
              {props.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number} · {r.roomType.name} ({r.roomType.priceNight}/nuit)
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-1.5">
            <Label>Client</Label>
            <Input
              value={form.guestName}
              onChange={(e) =>
                setForm((f) => ({ ...f, guestName: e.target.value }))
              }
              required
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Téléphone</Label>
            <Input
              value={form.guestPhone}
              onChange={(e) =>
                setForm((f) => ({ ...f, guestPhone: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Entrée</Label>
              <Input
                type="date"
                value={form.checkInDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, checkInDate: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Sortie</Label>
              <Input
                type="date"
                value={form.checkOutDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, checkOutDate: e.target.value }))
                }
              />
            </div>
          </div>
          <Button
            disabled={pending || !form.guestName || !form.checkInDate || !form.checkOutDate}
            onClick={create}
          >
            Réserver
          </Button>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-3">
          <h2 className="font-semibold">Actions du jour</h2>
          {props.stays.filter(
            (s) =>
              s.status === "RESERVED" || s.status === "CHECKED_IN",
          ).length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun séjour actif.</p>
          ) : (
            props.stays
              .filter((s) => s.status === "RESERVED" || s.status === "CHECKED_IN")
              .map((s) => {
                const charges =
                  s.folio?.lines.reduce((a, l) => a + l.amount, 0) ?? 0;
                const paid =
                  s.folio?.payments?.reduce((a, p) => a + p.amountCdf, 0) ?? 0;
                const balance = charges - paid;
                return (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        {s.guestName} · ch. {s.room.number}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.status} · solde {balance.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {s.status === "RESERVED" ? (
                        <Button
                          size="sm"
                          disabled={pending}
                          onClick={() => checkIn(s.id)}
                        >
                          Check-in
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={pending}
                          onClick={() => checkOut(s.id)}
                        >
                          Check-out
                        </Button>
                      )}
                      {balance > 0 ? (
                        <Button
                          size="sm"
                          variant="outline"
                          render={
                            <Link
                              href={branchCaissePath(
                                props.organizationId,
                                props.branchId,
                              )}
                            />
                          }
                        >
                          Caisse
                        </Button>
                      ) : null}
                    </div>
                  </div>
                );
              })
          )}
        </section>
      </div>
    </div>
  );
}
