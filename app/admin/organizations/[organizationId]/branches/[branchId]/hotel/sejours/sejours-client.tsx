"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CalendarDays, ClipboardList, Printer } from "lucide-react";
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
import {
  flatStayCountdown,
  formatFlatCountdownBanner,
} from "@/lib/hotel/stay-flat-countdown";
import { computeFlatOvertimeBilling } from "@/lib/hotel/stay-rate";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { StayPeriodField } from "@/components/hotel/stay-period-field";
import { cn } from "@/lib/utils";

type Room = {
  id: string;
  number: string;
  status: string;
  roomType: {
    name: string;
    priceNight: number;
    capacity?: number;
    kind?: string;
    seatsStandard?: number | null;
    seatsVip?: number | null;
  };
};

type Stay = {
  id: string;
  guestName: string;
  checkInDate: string | Date;
  checkOutDate: string | Date;
  status: string;
  roomId: string;
  checkedInAt?: string | Date | null;
  checkedOutAt?: string | Date | null;
  billingMode?: string;
  catalogUnitPrice?: number;
  unitPriceApplied?: number | null;
  flatAmount?: number | null;
  plannedHours?: number | null;
  rateNote?: string | null;
  room: {
    number: string;
    roomType: { name: string; priceNight: number; kind?: string };
  };
  folio: {
    id: string;
    checkoutQueuedAt?: string | Date | null;
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

function stayCheckoutDayKey(stay: Stay) {
  if (stay.checkedOutAt) {
    const d = new Date(stay.checkedOutAt);
    if (Number.isFinite(d.getTime())) {
      return toDateKey(
        new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())),
      );
    }
  }
  return toDateKey(asUtcDay(stay.checkOutDate));
}

function localTodayInputValue() {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDaysYmd(ymd: string, days: number) {
  const [y, m, d] = ymd.slice(0, 10).split("-").map(Number);
  const next = new Date(y!, (m ?? 1) - 1, (d ?? 1) + days);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Occupation active (réservé / check-in). */
function stayOccupiesCell(stay: Stay, cell: Date) {
  if (stay.status !== "RESERVED" && stay.status !== "CHECKED_IN") {
    return false;
  }
  return stayCoversCalendarDay(stay, cell);
}

/** Historique check-out (jours passés / période terminée). */
function stayHistoryCell(stay: Stay, cell: Date) {
  if (stay.status !== "CHECKED_OUT") return false;
  return stayCoversCalendarDay(stay, cell);
}

function stayCoversCalendarDay(stay: Stay, cell: Date) {
  const start = asUtcDay(stay.checkInDate);
  const end = asUtcDay(stay.checkOutDate);
  if (end.getTime() === start.getTime()) {
    return cell.getTime() === start.getTime();
  }
  // Inclure le jour de sortie pour l’historique (checkout)
  if (stay.status === "CHECKED_OUT") {
    return cell >= start && cell <= end;
  }
  return cell >= start && cell < end;
}

function formatStayRangeShort(stay: {
  checkInDate: string | Date;
  checkOutDate: string | Date;
}) {
  const a = asUtcDay(stay.checkInDate);
  const b = asUtcDay(stay.checkOutDate);
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
  };
  const from = a.toLocaleDateString("fr-FR", opts);
  const to = b.toLocaleDateString("fr-FR", opts);
  if (a.getTime() === b.getTime()) return from;
  return `${from} → ${to}`;
}

const ROOM_STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Libre",
  OCCUPIED: "Occupée",
  CLEANING: "Ménage",
  OUT_OF_ORDER: "HS",
};

function stayMetrics(stay: Stay, now = new Date()) {
  const checkIn = asUtcDay(stay.checkInDate);
  const checkOut = asUtcDay(stay.checkOutDate);
  const today = new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
  const isFlat = stay.billingMode === "FLAT";
  const totalNights = isFlat
    ? 0
    : nightsBetween(checkIn, checkOut);
  const elapsed =
    !isFlat &&
    (stay.status === "CHECKED_IN" || stay.status === "CHECKED_OUT")
      ? Math.max(
          0,
          Math.min(
            totalNights,
            Math.floor((today.getTime() - checkIn.getTime()) / 86400000),
          ),
        )
      : 0;
  const remaining = isFlat
    ? 0
    : Math.max(
        0,
        Math.ceil((checkOut.getTime() - today.getTime()) / 86400000),
      );
  const isCheckoutDay =
    !isFlat && toDateKey(today) === toDateKey(checkOut);
  const pastCheckoutDay = today.getTime() >= checkOut.getTime();
  const lateAfter10 =
    !isFlat &&
    stay.status === "CHECKED_IN" &&
    pastCheckoutDay &&
    now.getHours() >= HOTEL_CHECKOUT_HOUR;

  return {
    isFlat,
    plannedHours: stay.plannedHours ?? 0,
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
  const [form, setForm] = useState(() => {
    const today = localTodayInputValue();
    const t = new Date();
    const tomorrow = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    const y = tomorrow.getFullYear();
    const m = String(tomorrow.getMonth() + 1).padStart(2, "0");
    const d = String(tomorrow.getDate()).padStart(2, "0");
    return {
      roomId: props.rooms[0]?.id ?? "",
      guestName: "",
      guestPhone: "",
      checkInDate: today,
      checkOutDate: `${y}-${m}-${d}`,
      billingMode: "NIGHTLY" as "NIGHTLY" | "FLAT",
      unitPriceApplied: "",
      flatAmount: "",
      plannedHours: "",
      rateNote: "",
    };
  });
  const [extendStayId, setExtendStayId] = useState<string | null>(null);
  const [extendDate, setExtendDate] = useState("");
  const [noteStayId, setNoteStayId] = useState<string | null>(null);
  const [noteStatement, setNoteStatement] =
    useState<StayFolioStatementViewModel | null>(null);
  const [checkoutStayId, setCheckoutStayId] = useState<string | null>(null);
  const [checkoutStatement, setCheckoutStatement] =
    useState<StayFolioStatementViewModel | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [listFilter, setListFilter] = useState<"actifs" | "checkouts">(
    "actifs",
  );
  const [filterDate, setFilterDate] = useState(localTodayInputValue);
  const [mainTab, setMainTab] = useState("calendrier");
  const [bookingOpen, setBookingOpen] = useState(false);

  useEffect(() => {
    setNow(Date.now());
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

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

  const filteredListStays = useMemo(() => {
    const dayKey = filterDate.slice(0, 10);
    if (listFilter === "actifs") {
      // En cours = réservés + présents (pas de filtre date)
      return props.stays
        .filter((s) => s.status === "RESERVED" || s.status === "CHECKED_IN")
        .sort(
          (a, b) =>
            asUtcDay(a.checkOutDate).getTime() -
            asUtcDay(b.checkOutDate).getTime(),
        );
    }
    return props.stays
      .filter(
        (s) =>
          s.status === "CHECKED_OUT" && stayCheckoutDayKey(s) === dayKey,
      )
      .sort((a, b) => {
        const ta = a.checkedOutAt
          ? new Date(a.checkedOutAt).getTime()
          : asUtcDay(a.checkOutDate).getTime();
        const tb = b.checkedOutAt
          ? new Date(b.checkedOutAt).getTime()
          : asUtcDay(b.checkOutDate).getTime();
        return tb - ta;
      });
  }, [props.stays, listFilter, filterDate]);

  const notePrintHref = (stayId: string) =>
    `/admin/organizations/${props.organizationId}/branches/${props.branchId}/hotel/sejours/note/${stayId}?sign=1`;

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
    const cell = new Date(Date.UTC(year, month - 1, day));
    if (!stayOccupiesCell(stay, cell)) return null;

    const key = toDateKey(cell);
    const inKey = toDateKey(asUtcDay(stay.checkInDate));
    const isIn = key === inKey;

    if (stay.status === "CHECKED_IN") {
      // Check-in / occupation en cours — signal fort
      if (isIn) return "bg-orange-500 text-white ring-1 ring-orange-600/40";
      return "bg-sky-600 text-white";
    }
    // Réservation future
    if (isIn) return "bg-amber-400/90 text-amber-950";
    return "bg-sky-400/45 text-sky-950 dark:text-sky-100";
  }

  const selectedRoom = useMemo(
    () => props.rooms.find((r) => r.id === form.roomId) ?? null,
    [props.rooms, form.roomId],
  );
  const selectedIsMeeting = selectedRoom?.roomType.kind === "MEETING";
  const catalogPrice = selectedRoom?.roomType.priceNight ?? 0;
  const appliedNightPrice = useMemo(() => {
    if (form.unitPriceApplied.trim() === "") return catalogPrice;
    const n = Number(form.unitPriceApplied);
    return Number.isFinite(n) ? n : catalogPrice;
  }, [form.unitPriceApplied, catalogPrice]);
  const formNights = useMemo(() => {
    if (!form.checkInDate || !form.checkOutDate) return 0;
    const a = asUtcDay(form.checkInDate);
    const b = asUtcDay(form.checkOutDate);
    if (b < a) return 0;
    if (b.getTime() === a.getTime()) return form.billingMode === "FLAT" ? 0 : 0;
    return nightsBetween(a, b);
  }, [form.checkInDate, form.checkOutDate, form.billingMode]);

  const formCheckInIsToday = useMemo(() => {
    if (!form.checkInDate) return false;
    return toDateKey(asUtcDay(form.checkInDate)) === localTodayInputValue();
  }, [form.checkInDate]);

  const formImmediateCheckIn =
    form.billingMode === "FLAT" || formCheckInIsToday;
  const negotiatedPct =
    catalogPrice > 0 && Math.abs(appliedNightPrice - catalogPrice) >= 0.01
      ? Math.round(((catalogPrice - appliedNightPrice) / catalogPrice) * 1000) /
        10
      : null;

  function openBookingForm(opts?: { roomId?: string; dateKey?: string }) {
    const dateKey = opts?.dateKey ?? localTodayInputValue();
    if (dateKey < localTodayInputValue()) {
      toast.error("Impossible de réserver à une date antérieure.");
      return;
    }
    const room =
      props.rooms.find((r) => r.id === opts?.roomId) ??
      props.rooms.find((r) => r.id === form.roomId) ??
      props.rooms[0];
    if (!room) {
      toast.error("Aucun espace disponible.");
      return;
    }
    const isMeeting = room.roomType.kind === "MEETING";
    setForm({
      roomId: room.id,
      guestName: "",
      guestPhone: "",
      checkInDate: dateKey,
      checkOutDate: isMeeting ? dateKey : addDaysYmd(dateKey, 1),
      billingMode: isMeeting ? "FLAT" : "NIGHTLY",
      unitPriceApplied: "",
      flatAmount: "",
      plannedHours: isMeeting ? "4" : "",
      rateNote: "",
    });
    setBookingOpen(true);
  }

  function create() {
    start(async () => {
      try {
        if (!form.checkInDate || !form.checkOutDate) {
          toast.error("Choisissez la période d’entrée / sortie.");
          return;
        }
        if (form.checkInDate < localTodayInputValue()) {
          toast.error("Impossible de réserver à une date antérieure.");
          return;
        }
        await createStayAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          roomId: form.roomId,
          guestName: form.guestName,
          guestPhone: form.guestPhone || undefined,
          checkInDate: form.checkInDate,
          checkOutDate: form.checkOutDate,
          billingMode: form.billingMode,
          unitPriceApplied:
            form.billingMode === "NIGHTLY" && form.unitPriceApplied.trim() !== ""
              ? Number(form.unitPriceApplied)
              : null,
          flatAmount:
            form.billingMode === "FLAT" ? Number(form.flatAmount) : null,
          plannedHours:
            form.billingMode === "FLAT" && form.plannedHours.trim() !== ""
              ? Number(form.plannedHours)
              : null,
          rateNote: form.rateNote.trim() || null,
        });
        toast.success(
          formImmediateCheckIn
            ? form.billingMode === "FLAT"
              ? "Passage démarré · check-in effectué"
              : "Check-in effectué"
            : "Séjour réservé",
        );
        setForm((f) => ({
          ...f,
          guestName: "",
          guestPhone: "",
          unitPriceApplied: "",
          flatAmount: "",
          plannedHours: "",
          rateNote: "",
          billingMode: "NIGHTLY",
        }));
        setBookingOpen(false);
        setMainTab("sejours");
        setListFilter("actifs");
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
        if (!res.ok && res.needsRefund) {
          toast.message(
            `Remboursement ${formatPrimaryAmount(Math.abs(res.balance), props.rate)} — file caisse`,
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
          res.needsRefund
            ? `${res.guestName} · ch. ${res.roomNumber} — remboursement en file caisse`
            : `${res.guestName} · ch. ${res.roomNumber} — mis en file d’attente caisse`,
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
    setExtendStayId(stay.id);
    if (stay.billingMode === "FLAT") {
      setExtendDate("");
      return;
    }
    const out = asUtcDay(stay.checkOutDate);
    const next = new Date(out);
    next.setUTCDate(next.getUTCDate() + 1);
    setExtendDate(toDateKey(next));
  }

  function confirmExtend() {
    if (!extendStayId) return;
    const target = activeStays.find((s) => s.id === extendStayId);
    const isFlat = target?.billingMode === "FLAT";
    if (!isFlat && !extendDate) return;
    start(async () => {
      try {
        const res = await extendStayAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          stayId: extendStayId,
          newCheckOutDate: isFlat ? undefined : extendDate,
        });
        toast.success(
          res.mode === "FLAT"
            ? `Prolongé · +${res.extraHours} h · ${fmt(res.amount)}`
            : `Prolongé · +${res.extraNights} nuit(s) · ${fmt(res.amount)}`,
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
    <div className="mx-auto flex max-w-[100vw] flex-col gap-4 px-4 py-6 lg:max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold">Séjours</h1>
        <p className="text-sm text-muted-foreground">
          Planning · check-in · actifs · check-outs
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

      <Tabs
        value={mainTab}
        onValueChange={setMainTab}
        defaultValue="calendrier"
        className="gap-4"
      >
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 p-1 sm:inline-flex sm:w-fit sm:grid-cols-none">
          <TabsTrigger value="calendrier" className="gap-1.5 px-3 py-2">
            <CalendarDays className="size-4" />
            <span className="hidden sm:inline">Calendrier</span>
            <span className="sm:hidden">Agenda</span>
          </TabsTrigger>
          <TabsTrigger value="sejours" className="gap-1.5 px-3 py-2">
            <ClipboardList className="size-4" />
            <span className="hidden sm:inline">
              Actifs / check-outs
              {filteredListStays.length > 0
                ? ` (${filteredListStays.length})`
                : ""}
            </span>
            <span className="sm:hidden">Liste</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendrier" className="space-y-4 outline-none">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-orange-500">check-in</span>
              {" · "}
              <span className="font-semibold text-sky-600">occupé</span>
              {" · "}
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                historique
              </span>
              {" · "}
              <span className="font-semibold text-emerald-600">libre</span>
              {" · "}
              <span className="text-muted-foreground">passé vide</span>
              {" · clic = formulaire · libération "}
              <span className="font-semibold">{HOTEL_CHECKOUT_HOUR}h</span>
            </p>
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
                onChange={(e) =>
                  navigate(Number(e.target.value) || year, month)
                }
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
              <TooltipProvider delay={150}>
              <table className="min-w-max w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/90 px-3 py-2 text-left font-semibold">
                  Espace
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
                const roomStatusLabel =
                  ROOM_STATUS_LABEL[room.status] ?? room.status;
                return (
                  <tr key={room.id} className="border-b border-border/60">
                    <td className="sticky left-0 z-10 bg-card px-3 py-2 font-medium whitespace-nowrap">
                      <span className="inline-flex items-baseline gap-1">
                        <span>
                          {room.roomType.kind === "MEETING"
                            ? `Salle ${room.number}`
                            : room.number}
                        </span>
                        <span className="text-muted-foreground">→</span>
                        <span
                          className={cn(
                            "text-[11px] font-semibold lowercase",
                            room.status === "AVAILABLE"
                              ? "text-emerald-700 dark:text-emerald-300"
                              : room.status === "OCCUPIED"
                                ? "text-sky-700 dark:text-sky-300"
                                : room.status === "CLEANING"
                                  ? "text-muted-foreground"
                                  : "text-rose-700 dark:text-rose-300",
                          )}
                        >
                          {roomStatusLabel.toLowerCase()}
                        </span>
                      </span>
                      <span className="block text-[10px] text-muted-foreground">
                        {room.roomType.name}
                        {room.roomType.kind === "MEETING" ? " · réunion" : ""}
                      </span>
                    </td>
                    {dayCols.map((d) => {
                      const cell = new Date(Date.UTC(year, month - 1, d));
                      const cellKey = toDateKey(cell);
                      const isPast = cellKey < todayKey;
                      const covering = roomStays.find((s) =>
                        stayOccupiesCell(s, cell),
                      );
                      const histories = roomStays
                        .filter((s) => stayHistoryCell(s, cell))
                        .sort(
                          (a, b) =>
                            asUtcDay(b.checkInDate).getTime() -
                            asUtcDay(a.checkInDate).getTime(),
                        );
                      const history = !covering ? histories[0] : undefined;
                      const style = covering
                        ? stayStyle(covering, d)
                        : history
                          ? "bg-slate-400/55 text-slate-800 dark:text-slate-100"
                          : isPast
                            ? "bg-muted/50 text-muted-foreground/40"
                            : "bg-emerald-500/15";
                      const isIn =
                        covering &&
                        cellKey ===
                          toDateKey(asUtcDay(covering.checkInDate));
                      const histIn =
                        history &&
                        cellKey === toDateKey(asUtcDay(history.checkInDate));
                      const isFree = !covering && !isPast;
                      const cellButton = (
                        <button
                          type="button"
                          aria-disabled={!isFree}
                          onClick={() => {
                            if (!isFree) return;
                            openBookingForm({
                              roomId: room.id,
                              dateKey: cellKey,
                            });
                          }}
                          className={cn(
                            "flex h-8 w-full items-center justify-center rounded-sm text-[9px] font-bold",
                            style,
                            isPast &&
                              !covering &&
                              !history &&
                              "opacity-60",
                            isFree &&
                              "cursor-pointer transition hover:ring-2 hover:ring-emerald-500/60",
                            !isFree && "cursor-default",
                          )}
                        >
                          {covering && isIn
                            ? covering.guestName.slice(0, 2).toUpperCase()
                            : covering && covering.status === "CHECKED_IN"
                              ? "●"
                              : history && histIn
                                ? history.guestName.slice(0, 2).toUpperCase()
                                : history
                                  ? histories.length > 1
                                    ? String(histories.length)
                                    : "·"
                                  : null}
                        </button>
                      );
                      const showOccupantsTip =
                        Boolean(covering) || histories.length > 0;
                      return (
                        <td key={d} className="p-0.5">
                          {showOccupantsTip ? (
                            <Tooltip>
                              <TooltipTrigger render={cellButton} />
                              <TooltipContent
                                side="top"
                                className="max-w-[220px] flex-col items-stretch gap-1.5 bg-foreground px-2.5 py-2 text-left text-background"
                              >
                                {covering ? (
                                  <div>
                                    <p className="font-semibold">
                                      {covering.status === "CHECKED_IN"
                                        ? "En cours"
                                        : "Réservé"}
                                    </p>
                                    <p className="mt-0.5">
                                      {covering.guestName}
                                    </p>
                                    <p className="text-[10px] opacity-80">
                                      {formatStayRangeShort(covering)}
                                    </p>
                                  </div>
                                ) : null}
                                {histories.length > 0 ? (
                                  <div
                                    className={cn(
                                      covering &&
                                        "border-t border-background/25 pt-1.5",
                                    )}
                                  >
                                    <p className="font-semibold">
                                      Historique
                                      {histories.length > 1
                                        ? ` (${histories.length})`
                                        : ""}
                                    </p>
                                    <ul className="mt-1 space-y-1">
                                      {histories.map((h) => (
                                        <li key={h.id}>
                                          <span className="font-medium">
                                            {h.guestName}
                                          </span>
                                          <span className="block text-[10px] opacity-80">
                                            {formatStayRangeShort(h)}
                                          </span>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                ) : null}
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger render={cellButton} />
                              <TooltipContent>
                                {isPast
                                  ? "Passé · aucune activité"
                                  : "Libre · cliquer pour réserver"}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
              </TooltipProvider>
        </div>
          )}
        </TabsContent>

        <TabsContent value="sejours" className="outline-none">
          <section className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold">
                  {listFilter === "actifs"
                    ? "Séjours actifs"
                    : "Check-outs du jour"}
                </h2>
              <p className="text-xs text-muted-foreground">
                {listFilter === "actifs"
                  ? "Réservés et présents (en cours)"
                  : "Factures à remettre au client pour signature"}
              </p>
            </div>
            <Badge variant="secondary">{filteredListStays.length}</Badge>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
              <button
                type="button"
                onClick={() => setListFilter("actifs")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  listFilter === "actifs"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                Actifs
              </button>
              <button
                type="button"
                onClick={() => setListFilter("checkouts")}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                  listFilter === "checkouts"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                Check-outs
              </button>
            </div>
            {listFilter === "checkouts" ? (
              <>
                <div className="grid gap-1">
                  <Label htmlFor="stay-filter-date" className="text-xs">
                    Date
                  </Label>
                  <Input
                    id="stay-filter-date"
                    type="date"
                    className="h-8 w-auto"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </div>
                {filterDate !== localTodayInputValue() ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setFilterDate(localTodayInputValue())}
                  >
                    Aujourd’hui
                  </Button>
                ) : null}
              </>
            ) : null}
          </div>

          {filteredListStays.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {listFilter === "actifs"
                ? "Aucun séjour en cours."
                : "Aucun check-out pour cette date."}
            </p>
          ) : (
            <ul className="space-y-3">
              {filteredListStays.map((s) => {
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
                const isCheckoutRow = s.status === "CHECKED_OUT";
                const flatFrozenAt = s.folio?.checkoutQueuedAt ?? null;
                const flatFrozen = flatFrozenAt != null;
                const flatSlots =
                  s.folio?.lines.filter((l) => l.kind === "STAY_FLAT").length ||
                  1;
                const flatCd =
                  m.isFlat && s.status === "CHECKED_IN"
                    ? flatStayCountdown({
                        plannedHours: s.plannedHours,
                        checkedInAt: s.checkedInAt,
                        slots: flatSlots,
                        now,
                        frozenAt: flatFrozenAt,
                      })
                    : null;
                const flatOt =
                  flatCd?.overdue
                    ? computeFlatOvertimeBilling({
                        plannedHours: s.plannedHours,
                        flatAmount: s.flatAmount,
                        checkedInAt: s.checkedInAt,
                        slots: flatSlots,
                        endedAt: flatFrozenAt
                          ? new Date(flatFrozenAt)
                          : new Date(now),
                      })
                    : null;
                return (
                  <li
                    key={s.id}
                    className={cn(
                      "rounded-xl border px-3 py-3 text-sm",
                      isCheckoutRow
                        ? "border-border bg-muted/10"
                        : flatCd?.tone === "critical" || flatCd?.overdue
                          ? "border-rose-500/45 bg-rose-500/5"
                          : flatCd?.tone === "warn"
                            ? "border-amber-500/45 bg-amber-500/5"
                            : m.lateAfter10
                              ? "border-rose-500/40 bg-rose-500/5"
                              : m.isCheckoutDay
                                ? "border-amber-500/40 bg-amber-500/5"
                                : "border-border bg-muted/15",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 space-y-1">
                        <p className="font-semibold">
                          {s.guestName} ·{" "}
                          {s.room.roomType.kind === "MEETING"
                            ? `salle ${s.room.number}`
                            : `ch. ${s.room.number}`}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant={
                              s.status === "CHECKED_IN" ? "default" : "secondary"
                            }
                          >
                            {STATUS_LABEL[s.status] ?? s.status}
                          </Badge>
                          {m.isFlat ? (
                            <Badge variant="outline">
                              {m.plannedHours > 0
                                ? flatSlots > 1
                                  ? `${m.plannedHours} h × ${flatSlots}`
                                  : `${m.plannedHours} h`
                                : "Passage"}
                            </Badge>
                          ) : (
                            <>
                              <Badge variant="outline">
                                {m.totalNights} jour
                                {m.totalNights > 1 ? "s" : ""}
                              </Badge>
                              <Badge variant="outline">
                                {m.remaining} restant
                                {m.remaining > 1 ? "s" : ""}
                              </Badge>
                            </>
                          )}
                          {!m.isFlat && m.lateAfter10 ? (
                            <Badge variant="destructive">
                              Après {HOTEL_CHECKOUT_HOUR}h · nuitée due
                            </Badge>
                          ) : !m.isFlat && m.isCheckoutDay ? (
                            <Badge variant="destructive">
                              Départ aujourd’hui · avant {HOTEL_CHECKOUT_HOUR}h
                            </Badge>
                          ) : null}
                          {flatCd?.overdue ? (
                            <Badge variant="destructive">Temps dépassé</Badge>
                          ) : flatCd?.tone === "critical" ? (
                            <Badge variant="destructive">Fin imminente</Badge>
                          ) : flatCd?.tone === "warn" ? (
                            <Badge variant="secondary">Bientôt la fin</Badge>
                          ) : null}
                          {s.billingMode === "FLAT" ? (
                            <Badge variant="secondary">Passage</Badge>
                          ) : s.unitPriceApplied != null &&
                            Math.abs(
                              (s.unitPriceApplied ?? 0) -
                                (s.catalogUnitPrice ??
                                  s.room.roomType.priceNight),
                            ) >= 0.01 ? (
                            <Badge variant="secondary">Tarif négocié</Badge>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {toDateKey(m.checkIn)}
                          {m.isFlat ? "" : ` → ${toDateKey(m.checkOut)}`}
                          {s.status === "CHECKED_IN" && !m.isFlat
                            ? ` · ${m.elapsed} nuit(s) écoulée(s)`
                            : ""}
                          {" · "}
                          solde note {fmtBoth(balance)} ·{" "}
                          {m.isFlat
                            ? `passage ${fmt(s.flatAmount ?? 0)}${
                                m.plannedHours > 0
                                  ? ` · ${m.plannedHours} h`
                                  : ""
                              }`
                            : `${fmt(
                                s.unitPriceApplied ??
                                  s.catalogUnitPrice ??
                                  s.room.roomType.priceNight,
                              )}/nuit`}
                        </p>
                        {m.isFlat && s.status === "CHECKED_IN" ? (
                          flatCd ? (
                            <div
                              className={cn(
                                "mt-1.5 rounded-lg border px-2.5 py-2 text-xs",
                                flatCd.overdue || flatCd.tone === "critical"
                                  ? "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100"
                                  : flatCd.tone === "warn"
                                    ? "border-amber-500/40 bg-amber-500/10 text-amber-950 dark:text-amber-100"
                                    : "border-sky-500/30 bg-sky-500/10 text-sky-950 dark:text-sky-100",
                              )}
                            >
                              <p className="font-semibold tabular-nums">
                                {formatFlatCountdownBanner(flatCd, {
                                  frozen: flatFrozen,
                                })}
                              </p>
                              <p className="mt-0.5 opacity-90">
                                Écoulé {flatCd.elapsedLabel}
                                {flatSlots > 1
                                  ? ` · ${flatSlots} créneaux`
                                  : ""}{" "}
                                · fin prévue{" "}
                                {flatCd.endsAt.toLocaleTimeString("fr-FR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                              {flatOt && flatOt.extraHours > 0 ? (
                                <p className="mt-1 font-medium tabular-nums">
                                  +{flatOt.extraHours} h supp. ·{" "}
                                  {fmt(flatOt.amount)} (
                                  {fmt(flatOt.hourlyRate)}/h)
                                </p>
                              ) : null}
                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-background/60">
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-[width]",
                                    flatCd.overdue || flatCd.tone === "critical"
                                      ? "bg-rose-600"
                                      : flatCd.tone === "warn"
                                        ? "bg-amber-500"
                                        : "bg-sky-500",
                                  )}
                                  style={{
                                    width: `${Math.round(flatCd.progress * 100)}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                              Décompte après check-in (heure de début
                              manquante).
                            </p>
                          )
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {isCheckoutRow ? (
                          <>
                            <Button
                              size="sm"
                              className="gap-1.5"
                              render={
                                <a
                                  href={notePrintHref(s.id)}
                                  target="_blank"
                                  rel="noreferrer"
                                />
                              }
                            >
                              <Printer className="size-3.5" />
                              Reçu
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
                          </>
                        ) : (
                          <>
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
                              disabled={
                                pending ||
                                (s.billingMode === "FLAT" &&
                                  !(
                                    s.plannedHours != null &&
                                    s.plannedHours > 0
                                  ))
                              }
                              title={
                                s.billingMode === "FLAT" &&
                                !(s.plannedHours != null && s.plannedHours > 0)
                                  ? "Durée du passage manquante"
                                  : undefined
                              }
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
                            ) : balance < -0.01 ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                render={
                                  <Link
                                    href={`${branchCaissePath(
                                      props.organizationId,
                                      props.branchId,
                                    )}?tab=folios&queue=1`}
                                  />
                                }
                              >
                                Rembourser
                              </Button>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          </section>
        </TabsContent>
      </Tabs>

      <Dialog open={bookingOpen} onOpenChange={setBookingOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {formImmediateCheckIn
                ? form.billingMode === "FLAT"
                  ? "Nouveau passage · check-in"
                  : "Arrivée aujourd’hui · check-in"
                : "Nouvelle réservation"}
            </DialogTitle>
            <DialogDescription>
              {selectedRoom
                ? selectedIsMeeting
                  ? `Salle ${selectedRoom.number} · entrée ${form.checkInDate}`
                  : `Ch. ${selectedRoom.number} · entrée ${form.checkInDate}`
                : `Entrée ${form.checkInDate}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label>Chambre / salle</Label>
            <SearchCombobox
              items={props.rooms.map((r) => ({
                value: r.id,
                label:
                  r.roomType.kind === "MEETING"
                    ? `Salle ${r.number} · ${r.roomType.name} (${fmt(r.roomType.priceNight)}/créneau${
                        r.roomType.seatsStandard != null ||
                        r.roomType.seatsVip != null
                          ? ` · ${r.roomType.seatsStandard ?? 0} simple / ${r.roomType.seatsVip ?? 0} VIP`
                          : r.roomType.capacity
                            ? ` · ${r.roomType.capacity} pl.`
                            : ""
                      })`
                    : `Ch. ${r.number} · ${r.roomType.name} (${fmt(r.roomType.priceNight)}/nuit)`,
              }))}
              value={form.roomId}
              onValueChange={(roomId) => {
                const room = props.rooms.find((r) => r.id === roomId);
                const isMeeting = room?.roomType.kind === "MEETING";
                setForm((f) => ({
                  ...f,
                  roomId,
                  unitPriceApplied: "",
                  ...(isMeeting
                    ? {
                        billingMode: "FLAT" as const,
                        plannedHours: f.plannedHours || "4",
                        checkInDate: f.checkInDate || localTodayInputValue(),
                        checkOutDate:
                          f.checkInDate || localTodayInputValue(),
                      }
                    : {}),
                }));
              }}
              placeholder="Rechercher chambre ou salle…"
              emptyText="Aucun espace trouvé."
            />
            {selectedRoom ? (
              <p className="text-[11px] text-muted-foreground">
                {selectedIsMeeting
                  ? `Salle de réunion · tarif catalogue ${fmt(catalogPrice)}/créneau · ${
                      selectedRoom.roomType.seatsStandard != null ||
                      selectedRoom.roomType.seatsVip != null
                        ? `${selectedRoom.roomType.seatsStandard ?? 0} places simples · ${selectedRoom.roomType.seatsVip ?? 0} VIP`
                        : `capacité ${selectedRoom.roomType.capacity ?? "—"}`
                    }`
                  : `Tarif catalogue · ${fmt(catalogPrice)}/nuit`}
              </p>
            ) : null}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1.2fr_0.8fr]">
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
          </div>
          <StayPeriodField
            checkInDate={form.checkInDate}
            checkOutDate={form.checkOutDate}
            allowSameDay={form.billingMode === "FLAT"}
            onChange={({ checkInDate, checkOutDate }) =>
              setForm((f) => ({ ...f, checkInDate, checkOutDate }))
            }
          />

          <div className="grid gap-2 rounded-xl border border-border/70 bg-muted/20 p-3">
            <Label>Facturation hébergement</Label>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-border/60 bg-background/70 p-1">
              {(
                [
                  ["NIGHTLY", "Nuitée(s)"],
                  ["FLAT", "Passage"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setForm((f) => {
                      const today = localTodayInputValue();
                      if (id === "FLAT") {
                        return {
                          ...f,
                          billingMode: id,
                          rateNote: f.rateNote,
                          checkInDate: f.checkInDate || today,
                          checkOutDate: f.checkInDate || today,
                          plannedHours: f.plannedHours || "4",
                        };
                      }
                      const inDate = f.checkInDate || today;
                      let outDate = f.checkOutDate;
                      if (!outDate || outDate <= inDate) {
                        const [y, m, d] = inDate.split("-").map(Number);
                        const next = new Date(y!, (m ?? 1) - 1, (d ?? 1) + 1);
                        outDate = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
                      }
                      return {
                        ...f,
                        billingMode: id,
                        rateNote: f.rateNote,
                        checkInDate: inDate,
                        checkOutDate: outDate,
                      };
                    })
                  }
                  className={cn(
                    "rounded-md px-2 py-2 text-xs font-semibold transition",
                    form.billingMode === id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {form.billingMode === "NIGHTLY" ? (
              <div className="grid gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="unit-price">Tarif / nuit appliqué</Label>
                  <Input
                    id="unit-price"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder={catalogPrice ? String(catalogPrice) : "0"}
                    value={form.unitPriceApplied}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        unitPriceApplied: e.target.value,
                      }))
                    }
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Vide = catalogue ({fmt(catalogPrice)}/nuit)
                    {negotiatedPct != null
                      ? negotiatedPct > 0
                        ? ` · négocié −${negotiatedPct} %`
                        : ` · +${Math.abs(negotiatedPct)} %`
                      : ""}
                    {formNights > 0
                      ? ` · total ${fmt(formNights * appliedNightPrice)}`
                      : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="flat-amount">Montant passage</Label>
                  <Input
                    id="flat-amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.flatAmount}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, flatAmount: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="planned-hours">Durée (heures)</Label>
                  <Input
                    id="planned-hours"
                    type="number"
                    min={1}
                    step={1}
                    value={form.plannedHours}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, plannedHours: e.target.value }))
                    }
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Créneau facturé (ex. 4 h). Pas de règle {HOTEL_CHECKOUT_HOUR}
                    h — prolongation = même durée au même montant.
                  </p>
                </div>
              </div>
            )}

            {(form.billingMode === "FLAT" ||
              (form.unitPriceApplied.trim() !== "" &&
                Math.abs(appliedNightPrice - catalogPrice) >= 0.01)) && (
              <div className="grid gap-1.5">
                <Label htmlFor="rate-note">Motif</Label>
                <Input
                  id="rate-note"
                  value={form.rateNote}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, rateNote: e.target.value }))
                  }
                  placeholder={
                    form.billingMode === "FLAT"
                      ? "Ex. day use 4 h, accord client…"
                      : "Ex. réduction fidélité, promo…"
                  }
                />
              </div>
            )}
          </div>

          <Button
            disabled={
              pending ||
              !form.guestName ||
              !form.checkInDate ||
              !form.checkOutDate ||
              (form.billingMode === "FLAT" &&
                (!(Number(form.flatAmount) >= 0) ||
                  !(Number(form.plannedHours) > 0) ||
                  !form.rateNote.trim())) ||
              (form.billingMode === "NIGHTLY" &&
                form.unitPriceApplied.trim() !== "" &&
                Math.abs(appliedNightPrice - catalogPrice) >= 0.01 &&
                !form.rateNote.trim())
            }
            onClick={create}
          >
            {formImmediateCheckIn
              ? form.billingMode === "FLAT"
                ? "Check-in passage"
                : "Check-in"
                : "Réserver"}
          </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!extendTarget}
        onOpenChange={(open) => {
          if (!open) setExtendStayId(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {extendTarget?.billingMode === "FLAT"
                ? "Prolonger le passage"
                : "Prolonger le séjour"}
            </DialogTitle>
            <DialogDescription>
              {extendTarget?.billingMode === "FLAT"
                ? `${extendTarget.guestName} · ch. ${extendTarget.room.number} — ajoute un créneau de ${extendTarget.plannedHours ?? "?"} h au même montant (sans règle ${HOTEL_CHECKOUT_HOUR}h).`
                : extendTarget
                  ? `${extendTarget.guestName} · ch. ${extendTarget.room.number} — les nuitées ajoutées sont facturées sur la note de chambre.`
                  : null}
            </DialogDescription>
          </DialogHeader>
          {extendTarget?.billingMode === "FLAT" ? (
            <div className="rounded-xl border border-border bg-muted/30 px-3 py-3 text-sm">
              <p className="font-semibold">
                +{extendTarget.plannedHours} h ·{" "}
                {fmt(extendTarget.flatAmount ?? 0)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Même durée et même montant que le passage initial.
              </p>
            </div>
          ) : (
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
                          asUtcDay(extendTarget.checkOutDate).getTime() +
                            86400000,
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
                    ) *
                      (extendTarget.unitPriceApplied ??
                        extendTarget.catalogUnitPrice ??
                        extendTarget.room.roomType.priceNight),
                  )}{" "}
                  à facturer
                </p>
              ) : null}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExtendStayId(null)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button
              disabled={
                pending ||
                (extendTarget?.billingMode === "FLAT"
                  ? !(
                      extendTarget.plannedHours != null &&
                      extendTarget.plannedHours > 0
                    )
                  : !extendDate)
              }
              onClick={confirmExtend}
            >
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
                  : checkoutStatement.balance < -0.01
                    ? `Ch. ${checkoutStatement.roomNumber} · trop-perçu · rembourser ${fmt(Math.abs(checkoutStatement.balance))} (nuitées consommées, limite ${HOTEL_CHECKOUT_HOUR}h).`
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
            ) : checkoutStatement && checkoutStatement.balance < -0.01 ? (
              <Button disabled={pending} onClick={payCheckoutAtCaisse}>
                File caisse · rembourser ({fmt(Math.abs(checkoutStatement.balance))})
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
