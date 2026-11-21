"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const MONTHS = [
  "Janv.",
  "Févr.",
  "Mars",
  "Avr.",
  "Mai",
  "Juin",
  "Juil.",
  "Août",
  "Sept.",
  "Oct.",
  "Nov.",
  "Déc.",
];

const MONTH_NAMES = [
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

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];
const MIN_YEAR = 2020;
const MAX_SPAN = 366;

type View = "jour" | "jours" | "mois" | "annee";

export function PcaPeriodPicker(props: {
  view: View;
  year: number;
  month: number;
  day: number;
  span: number;
  periodLabel: string;
  rangeLabel: string;
  reportKind: string;
  todayYear: number;
  todayMonth: number;
  todayDay: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [cursorYear, setCursorYear] = useState(props.year);
  const [cursorMonth, setCursorMonth] = useState(props.month);
  const [anchor, setAnchor] = useState<{ year: number; month: number; day: number } | null>(null);

  useEffect(() => {
    setCursorYear(props.year);
    setCursorMonth(props.month);
  }, [props.year, props.month]);

  function go(next: { view: View; year: number; month: number; day?: number; n?: number }) {
    const params = new URLSearchParams();
    params.set("vue", next.view);
    params.set("annee", String(next.year));
    if (next.view !== "annee") params.set("mois", String(next.month));
    if (next.view === "jour" || next.view === "jours") {
      params.set("jour", String(next.day ?? props.day));
    }
    if (next.view === "jours") params.set("n", String(next.n ?? props.span));
    setOpen(false);
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  const yearBlocked = (year: number) => year < MIN_YEAR || year > props.todayYear;
  const monthBlocked = (year: number, month: number) =>
    yearBlocked(year) || (year === props.todayYear && month > props.todayMonth);
  const dayBlocked = (year: number, month: number, day: number) =>
    monthBlocked(year, month) ||
    (year === props.todayYear && month === props.todayMonth && day > props.todayDay);

  const yearPageStart = MIN_YEAR + Math.floor((cursorYear - MIN_YEAR) / 12) * 12;
  const yearPage = Array.from({ length: 12 }, (_, index) => yearPageStart + index).filter(
    (year) => year <= props.todayYear,
  );

  const dayGrid = buildDayGrid(cursorYear, cursorMonth);
  const endTime = new Date(props.year, props.month - 1, props.day).getTime();
  const spanStart = endTime - (Math.max(props.span, 1) - 1) * 86_400_000;
  const dayMode = props.view === "jour" || props.view === "jours";

  function shiftMonth(delta: number) {
    const next = new Date(cursorYear, cursorMonth - 1 + delta, 1);
    const year = next.getFullYear();
    const month = next.getMonth() + 1;
    if (monthBlocked(year, month)) return;
    setCursorYear(year);
    setCursorMonth(month);
  }

  function pickDay(year: number, month: number, day: number) {
    if (!anchor) {
      setAnchor({ year, month, day });
      return;
    }
    let start = anchor;
    let end = { year, month, day };
    if (dateTime(end) < dateTime(start)) {
      const swap = start;
      start = end;
      end = swap;
    }
    const span = Math.min(
      MAX_SPAN,
      Math.round((dateTime(end) - dateTime(start)) / 86_400_000) + 1,
    );
    setAnchor(null);
    if (span <= 1) go({ view: "jour", year: end.year, month: end.month, day: end.day });
    else go({ view: "jours", year: end.year, month: end.month, day: end.day, n: span });
  }

  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center gap-2",
        pending && "opacity-70",
      )}
      aria-busy={pending}
    >
      <div className="flex rounded-full bg-muted p-0.5 text-xs">
        {(
          [
            ["jour", "Jour"],
            ["mois", "Mensuel"],
            ["annee", "Annuel"],
          ] as const
        ).map(([id, label]) => {
          const active = id === "jour" ? dayMode : props.view === id;
          return (
            <button
              key={id}
              type="button"
              className={cn(
                "rounded-full px-2.5 py-1 font-medium",
                active
                  ? "bg-[#1b9a4b] text-white"
                  : "text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={active}
              onClick={() => {
                if (active) {
                  setOpen(true);
                  return;
                }
                if (id === "jour") {
                  go({ view: "jour", year: props.year, month: props.month, day: props.day });
                } else {
                  go({ view: id, year: props.year, month: props.month });
                }
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setAnchor(null);
        }}
      >
        <PopoverTrigger className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-semibold shadow-sm hover:bg-[#f3fbf6]">
          <CalendarDays className="size-3.5 text-[#157a3c]" />
          {props.periodLabel}
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className={cn("gap-3 p-3", dayMode ? "w-[19rem]" : "w-[17.5rem]")}
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-30"
              aria-label={dayMode ? "Mois précédent" : "Année précédente"}
              disabled={
                dayMode
                  ? monthBlocked(cursorMonth === 1 ? cursorYear - 1 : cursorYear, cursorMonth === 1 ? 12 : cursorMonth - 1)
                  : props.view === "annee"
                    ? yearPageStart <= MIN_YEAR
                    : cursorYear <= MIN_YEAR
              }
              onClick={() => {
                if (dayMode) shiftMonth(-1);
                else if (props.view === "annee") {
                  setCursorYear(Math.max(MIN_YEAR, yearPageStart - 1));
                } else setCursorYear((year) => year - 1);
              }}
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-semibold tabular-nums">
              {dayMode
                ? `${MONTH_NAMES[cursorMonth - 1]} ${cursorYear}`
                : props.view === "annee"
                  ? `${yearPageStart} – ${Math.min(yearPageStart + 11, props.todayYear)}`
                  : cursorYear}
            </p>
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-full hover:bg-muted disabled:opacity-30"
              aria-label={dayMode ? "Mois suivant" : "Année suivante"}
              disabled={
                dayMode
                  ? monthBlocked(
                      cursorMonth === 12 ? cursorYear + 1 : cursorYear,
                      cursorMonth === 12 ? 1 : cursorMonth + 1,
                    )
                  : props.view === "annee"
                    ? yearPageStart + 12 > props.todayYear
                    : cursorYear >= props.todayYear
              }
              onClick={() => {
                if (dayMode) shiftMonth(1);
                else if (props.view === "annee") {
                  setCursorYear(Math.min(props.todayYear, yearPageStart + 12));
                } else setCursorYear((year) => year + 1);
              }}
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          {props.view === "mois" ? (
            <div className="grid grid-cols-4 gap-1.5">
              {MONTHS.map((label, index) => {
                const month = index + 1;
                const selected = props.year === cursorYear && props.month === month;
                const blocked = monthBlocked(cursorYear, month);
                return (
                  <button
                    key={label}
                    type="button"
                    disabled={blocked}
                    aria-pressed={selected}
                    className={cn(
                      "h-9 rounded-lg text-xs font-medium",
                      selected ? "bg-[#1b9a4b] text-white" : "hover:bg-[#f3fbf6]",
                      blocked && "pointer-events-none text-muted-foreground/40",
                    )}
                    onClick={() => go({ view: "mois", year: cursorYear, month })}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : props.view === "annee" ? (
            <div className="grid grid-cols-3 gap-1.5">
              {yearPage.map((year) => {
                const selected = props.year === year;
                const blocked = yearBlocked(year);
                return (
                  <button
                    key={year}
                    type="button"
                    disabled={blocked}
                    aria-pressed={selected}
                    className={cn(
                      "h-9 rounded-lg text-xs font-medium tabular-nums",
                      selected ? "bg-[#1b9a4b] text-white" : "hover:bg-[#f3fbf6]",
                      blocked && "pointer-events-none text-muted-foreground/40",
                    )}
                    onClick={() => go({ view: "annee", year, month: props.month })}
                  >
                    {year}
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <p className="text-center text-[11px] text-muted-foreground">
                {anchor
                  ? `Du ${anchor.day} ${MONTHS[anchor.month - 1]} — choisissez la fin`
                  : "Choisissez le début, puis la fin"}
              </p>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px]">
                {WEEKDAYS.map((label, index) => (
                  <span key={`${label}-${index}`} className="py-1 font-medium text-muted-foreground">
                    {label}
                  </span>
                ))}
                {dayGrid.map((day, index) => {
                  if (!day) return <span key={`empty-${index}`} />;
                  const time = new Date(cursorYear, cursorMonth - 1, day).getTime();
                  const isAnchor =
                    anchor?.year === cursorYear &&
                    anchor.month === cursorMonth &&
                    anchor.day === day;
                  const selected =
                    !anchor &&
                    props.year === cursorYear &&
                    props.month === cursorMonth &&
                    props.day === day;
                  const inRange =
                    !anchor &&
                    time >= spanStart &&
                    time <= endTime;
                  const blocked = dayBlocked(cursorYear, cursorMonth, day);
                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={blocked}
                      aria-pressed={selected || isAnchor}
                      className={cn(
                        "h-8 rounded-lg font-medium tabular-nums",
                        isAnchor || selected
                          ? "bg-[#1b9a4b] text-white"
                          : inRange
                            ? "bg-[#e7f6ec] text-[#0e6b3c]"
                            : "hover:bg-[#f3fbf6]",
                        blocked && "pointer-events-none text-muted-foreground/35",
                      )}
                      onClick={() => pickDay(cursorYear, cursorMonth, day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </PopoverContent>
      </Popover>

      <p className="rounded-full bg-[#f3fbf6] px-2.5 py-1 text-xs font-medium text-[#157a3c]">
        {props.reportKind} · {props.rangeLabel}
      </p>
    </div>
  );
}

function dateTime(date: { year: number; month: number; day: number }) {
  return new Date(date.year, date.month - 1, date.day).getTime();
}

function buildDayGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month, 0).getDate();
  const cells: Array<number | null> = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= count; day += 1) cells.push(day);
  return cells;
}
