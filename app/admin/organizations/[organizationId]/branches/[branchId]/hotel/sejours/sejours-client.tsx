"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  checkInStayAction,
  checkOutStayAction,
  createStayAction,
  extendStayAction,
  getStayFolioStatementAction,
  prepareStayCheckoutBillingAction,
} from "@/lib/hotel/actions";
import { HOTEL_CHECKOUT_HOUR } from "@/lib/hotel/constants";
import { branchCaissePath } from "@/lib/branch/paths";
import {
  formatBothAmounts,
  formatConfiguredRateLabel,
  formatPrimaryAmount,
  type NormalizedUsdCdfRate,
} from "@/lib/cash/exchange";
import {
  StayFolioStatementView,
  type StayFolioStatementViewModel,
} from "@/components/hotel/stay-folio-statement";
import { SearchCombobox } from "@/components/ui/search-combobox";
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
  room: {
    number: string;
    roomType: { name: string; priceNight: number };
  };
  folio: {
    id: string;
    lines: {
      amount: number;
      description?: string;
      kind?: string;
      quantity?: number;
    }[];
    payments?: { amountCdf: number; amountForeign?: number | null }[];
  } | null;
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

const STATUS_LABEL: Record<string, string> = {
  RESERVED: "Réservé",
  CHECKED_IN: "Occupé",
  CHECKED_OUT: "Terminé",
  CANCELLED: "Annulé",
  NO_SHOW: "No-show",
};

function toDateKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function asUtcDay(value: string | Date) {
  if (value instanceof Date) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }
  const [y, m, day] = value.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, day ?? 1));
}

function nightsBetween(checkIn: Date, checkOut: Date) {
  return Math.max(
    1,
    Math.ceil((checkOut.getTime() - checkIn.getTime()) / 86400000),
  );
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function stayMetrics(stay: Stay, now = new Date()) {
  const checkIn = asUtcDay(stay.checkInDate);
  const checkOut = asUtcDay(stay.checkOutDate);
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const totalNights = nightsBetween(checkIn, checkOut);
  const elapsed =
    stay.status === "CHECKED_IN" || stay.status === "CHECKED_OUT"
      ? Math.max(
          0,
          Math.min(
            totalNights,
            Math.floor((today.getTime() - checkIn.getTime()) / 86400000),
          ),
        )
      : 0;
  const remaining = Math.max(
    0,
    Math.ceil((checkOut.getTime() - today.getTime()) / 86400000),
  );
  const isCheckoutDay = toDateKey(today) === toDateKey(checkOut);
  const pastCheckoutDay = today.getTime() >= checkOut.getTime();
  const lateAfter10 =
    stay.status === "CHECKED_IN" &&
    pastCheckoutDay &&
    now.getHours() >= HOTEL_CHECKOUT_HOUR;

  return {
    totalNights,
    elapsed,
    remaining,
    isCheckoutDay,
    lateAfter10,
    checkIn,
    checkOut,
  };
}

export function SejoursClient(props: {
  organizationId: string;
  branchId: string;
  rooms: Room[];
  stays: Stay[];
  yearStays: YearStay[];
  initialYear: number;
  initialMonth: number;
  rate?: NormalizedUsdCdfRate | null;
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
  const [extendStayId, setExtendStayId] = useState<string | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [noteStayId, setNoteStayId] = useState<string | null>(null);
  const [noteStatement, setNoteStatement] =
    useState<StayFolioStatementViewModel | null>(null);
  const [checkoutStayId, setCheckoutStayId] = useState<string | null>(null);
  const [checkoutStatement, setCheckoutStatement] =
    useState<StayFolioStatementViewModel | null>(null);

  function fmt(amountUsd: number) {
    return formatPrimaryAmount(amountUsd, props.rate);
  }

  function fmtBoth(amountUsd: number) {
    return formatBothAmounts(amountUsd, props.rate);
  }

  const todayKey = toDateKey(new Date());
  const dim = daysInMonth(year, month);
  const dayCols = useMemo(
    () => Array.from({ length: dim }, (_, i) => i + 1),
    [dim],
  );

  const activeStays = useMemo(
    () =>
      props.stays
        .filter((s) => s.status === "RESERVED" || s.status === "CHECKED_IN")
        .sort(
          (a, b) =>
            asUtcDay(a.checkOutDate).getTime() -
            asUtcDay(b.checkOutDate).getTime(),
        ),
    [props.stays],
  );

  const extendTarget = useMemo(
    () => activeStays.find((s) => s.id === extendStayId) ?? null,
    [activeStays, extendStayId],
  );

  function navigate(y: number, m: number) {
    setYear(y);
    setMonth(m);
    router.push(`?year=${y}&month=${m}`);
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
    const isOut = key === outKey;
    const isIn = key === inKey;
    const isHistory = stay.status === "CHECKED_OUT";

    if (isOut) return "bg-red-500 text-white";
    if (isHistory) {
      if (isIn) return "bg-slate-400/80 text-white";
      return "bg-slate-400/35 text-muted-foreground";
    }
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
        const statement = await getStayFolioStatementAction(
          props.organizationId,
          props.branchId,
          stayId,
          { forCheckout: true },
        );
        setCheckoutStayId(stayId);
        setCheckoutStatement({
          ...statement,
          payments: statement.payments.map((p) => ({
            ...p,
            paidAt: p.paidAt,
          })),
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function confirmCheckOut() {
    if (!checkoutStayId) return;
    const stayId = checkoutStayId;
    start(async () => {
      try {
        const res = await checkOutStayAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          stayId,
        });
        if (!res.ok && res.needsPayment) {
          toast.message(
            `Solde ${formatPrimaryAmount(res.balance, props.rate)} — mis en file d’attente caisse`,
          );
          setCheckoutStayId(null);
          setCheckoutStatement(null);
          router.push(
            `${branchCaissePath(props.organizationId, props.branchId)}?tab=folios&queue=1`,
          );
          return;
        }
        toast.success("Check-out effectué — imprimez la facture pour signature");
        setCheckoutStayId(null);
        setCheckoutStatement(null);
        window.open(
          `/admin/organizations/${props.organizationId}/branches/${props.branchId}/hotel/sejours/note/${stayId}?sign=1`,
          "_blank",
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function payCheckoutAtCaisse() {
    if (!checkoutStayId || !checkoutStatement) return;
    start(async () => {
      try {
        const res = await prepareStayCheckoutBillingAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          stayId: checkoutStayId,
        });
        toast.message(
          `${res.guestName} · ch. ${res.roomNumber} — mis en file d’attente caisse`,
        );
        setCheckoutStayId(null);
        setCheckoutStatement(null);
        router.push(
          `${branchCaissePath(props.organizationId, props.branchId)}?tab=folios&queue=1`,
        );
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function openNote(stayId: string) {
    start(async () => {
      try {
        const statement = await getStayFolioStatementAction(
          props.organizationId,
          props.branchId,
          stayId,
        );
        setNoteStayId(stayId);
        setNoteStatement({
          ...statement,
          payments: statement.payments.map((p) => ({
            ...p,
            paidAt: p.paidAt,
          })),
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function openExtend(stay: Stay) {
    const out = asUtcDay(stay.checkOutDate);
    const next = new Date(out);
    next.setUTCDate(next.getUTCDate() + 1);
    setExtendStayId(stay.id);
    setExtendDate(toDateKey(next));
  }

  function confirmExtend() {
    if (!extendStayId || !extendDate) return;
    start(async () => {
      try {
        const res = await extendStayAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          stayId: extendStayId,
          newCheckOutDate: extendDate,
        });
        toast.success(
          `Prolongé · +${res.extraNights} nuit(s) · ${fmt(res.amount)}`,
        );
        setExtendStayId(null);
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
            Planning · checkout{" "}
            <span className="font-semibold text-red-500">rouge</span>
            {" · "}historique{" "}
            <span className="font-semibold text-slate-500">gris</span>
            {" · "}libération chambre à{" "}
            <span className="font-semibold">{HOTEL_CHECKOUT_HOUR}h</span>
            {props.rate ? (
              <>
                {" · "}
                <span className="font-medium">
                  {formatConfiguredRateLabel(props.rate)}
                </span>
              </>
            ) : null}
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
                            {covering &&
                            cellKey ===
                              toDateKey(new Date(covering.checkInDate))
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Nouvelle réservation</h2>
          <div className="grid gap-1.5">
            <Label>Chambre</Label>
            <SearchCombobox
              items={props.rooms.map((r) => ({
                value: r.id,
                label: `${r.number} · ${r.roomType.name} (${fmt(r.roomType.priceNight)}/nuit)`,
              }))}
              value={form.roomId}
              onValueChange={(roomId) =>
                setForm((f) => ({ ...f, roomId }))
              }
              placeholder="Rechercher une chambre…"
              emptyText="Aucune chambre trouvée."
            />
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
            disabled={
              pending ||
              !form.guestName ||
              !form.checkInDate ||
              !form.checkOutDate
            }
            onClick={create}
          >
            Réserver
          </Button>
        </section>

        <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-semibold">Séjours actifs</h2>
              <p className="text-xs text-muted-foreground">
                Statut, durée, jours restants · libération à {HOTEL_CHECKOUT_HOUR}
                h sinon +1 nuitée
              </p>
            </div>
            <Badge variant="secondary">{activeStays.length}</Badge>
          </div>

          {activeStays.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucun séjour actif.</p>
          ) : (
            <ul className="space-y-3">
              {activeStays.map((s) => {
                const m = stayMetrics(s);
                const charges =
                  s.folio?.lines.reduce((a, l) => a + l.amount, 0) ?? 0;
                const paid =
                  s.folio?.payments?.reduce(
                    (a, p) =>
                      a +
                      (p.amountForeign != null && p.amountForeign > 0
                        ? p.amountForeign
                        : p.amountCdf),
                    0,
                  ) ?? 0;
                const balance = charges - paid;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-sm",
                      m.lateAfter10
                        ? "border-rose-500/40 bg-rose-500/5"
                        : m.isCheckoutDay
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-border bg-muted/15",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold">
                          {s.guestName} · ch. {s.room.number}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={
                              s.status === "CHECKED_IN" ? "default" : "secondary"
                            }
                          >
                            {STATUS_LABEL[s.status] ?? s.status}
                          </Badge>
                          <Badge variant="outline">
                            {m.totalNights} jour
                            {m.totalNights > 1 ? "s" : ""}
                          </Badge>
                          <Badge variant="outline">
                            {m.remaining} restant
                            {m.remaining > 1 ? "s" : ""}
                          </Badge>
                          {m.lateAfter10 ? (
                            <Badge variant="destructive">
                              Après {HOTEL_CHECKOUT_HOUR}h · nuitée due
                            </Badge>
                          ) : m.isCheckoutDay ? (
                            <Badge variant="destructive">
                              Départ aujourd’hui · avant {HOTEL_CHECKOUT_HOUR}h
                            </Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {toDateKey(m.checkIn)} → {toDateKey(m.checkOut)}
                          {s.status === "CHECKED_IN"
                            ? ` · ${m.elapsed} nuit(s) écoulée(s)`
                            : ""}
                          {" · "}
                          solde note {fmtBoth(balance)} ·{" "}
                          {fmt(s.room.roomType.priceNight)}/nuit
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
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
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() => openExtend(s)}
                        >
                          Prolongation
                        </Button>
                        {s.folio ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => openNote(s.id)}
                          >
                            Voir la note
                          </Button>
                        ) : null}
                        {balance > 0.01 ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            render={
                              <Link
                                href={`${branchCaissePath(
                                  props.organizationId,
                                  props.branchId,
                                )}?tab=folios`}
                              />
                            }
                          >
                            Caisse
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <Dialog
        open={!!extendTarget}
        onOpenChange={(open) => {
          if (!open) setExtendStayId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Prolonger le séjour</DialogTitle>
            <DialogDescription>
              {extendTarget
                ? `${extendTarget.guestName} · ch. ${extendTarget.room.number} — les nuitées ajoutées sont facturées sur la note de chambre.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label htmlFor="extend-date">Nouvelle date de sortie</Label>
            <Input
              id="extend-date"
              type="date"
              value={extendDate}
              min={
                extendTarget
                  ? toDateKey(
                      new Date(
                        asUtcDay(extendTarget.checkOutDate).getTime() + 86400000,
                      ),
                    )
                  : undefined
              }
              onChange={(e) => setExtendDate(e.target.value)}
            />
            {extendTarget && extendDate ? (
              <p className="text-xs text-muted-foreground">
                +
                {nightsBetween(
                  asUtcDay(extendTarget.checkOutDate),
                  asUtcDay(extendDate),
                )}{" "}
                nuit(s) ·{" "}
                {fmtBoth(
                  nightsBetween(
                    asUtcDay(extendTarget.checkOutDate),
                    asUtcDay(extendDate),
                  ) * extendTarget.room.roomType.priceNight,
                )}{" "}
                à facturer
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExtendStayId(null)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button disabled={pending || !extendDate} onClick={confirmExtend}>
              Confirmer la prolongation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!noteStatement}
        onOpenChange={(open) => {
          if (!open) {
            setNoteStayId(null);
            setNoteStatement(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Note de chambre</DialogTitle>
            <DialogDescription>
              Facture séjour — nuitées, consommations et solde.
            </DialogDescription>
          </DialogHeader>
          {noteStatement ? (
            <StayFolioStatementView
              statement={noteStatement}
              rate={props.rate}
            />
          ) : null}
          <DialogFooter className="gap-2 sm:justify-between">
            {noteStayId ? (
              <Button
                variant="outline"
                render={
                  <Link
                    href={`/admin/organizations/${props.organizationId}/branches/${props.branchId}/hotel/sejours/note/${noteStayId}`}
                    target="_blank"
                  />
                }
              >
                Imprimer
              </Button>
            ) : (
              <span />
            )}
            <Button
              variant="secondary"
              onClick={() => {
                setNoteStayId(null);
                setNoteStatement(null);
              }}
            >
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!checkoutStatement}
        onOpenChange={(open) => {
          if (!open) {
            setCheckoutStayId(null);
            setCheckoutStatement(null);
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Check-out
              {checkoutStatement
                ? ` — ${checkoutStatement.guestName}`
                : " — facture séjour"}
            </DialogTitle>
            <DialogDescription>
              {checkoutStatement
                ? checkoutStatement.balance > 0.01
                  ? `Ch. ${checkoutStatement.roomNumber} · solde à mettre en file d’attente caisse.`
                  : `Ch. ${checkoutStatement.roomNumber} · aucun solde — imprimer la facture générale pour signature client.`
                : `Nuitées recalculées selon les jours consommés (limite ${HOTEL_CHECKOUT_HOUR}h).`}
            </DialogDescription>
          </DialogHeader>
          {checkoutStatement ? (
            <StayFolioStatementView
              statement={checkoutStatement}
              rate={props.rate}
            />
          ) : null}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCheckoutStayId(null);
                setCheckoutStatement(null);
              }}
              disabled={pending}
            >
              Annuler
            </Button>
            {checkoutStatement && checkoutStatement.balance > 0.01 ? (
              <Button disabled={pending} onClick={payCheckoutAtCaisse}>
                Mettre en file d’attente caisse ({fmt(checkoutStatement.balance)})
              </Button>
            ) : (
              <Button disabled={pending} onClick={confirmCheckOut}>
                Check-out + imprimer facture
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
