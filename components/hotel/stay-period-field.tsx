"use client";

import { useMemo, useState } from "react";
import { CalendarRange } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { fr } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function toYmd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromYmd(value: string): Date | undefined {
  if (!value || value.length < 10) return undefined;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

function formatFrDay(d: Date) {
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function startOfLocalToday() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

export function StayPeriodField(props: {
  checkInDate: string;
  checkOutDate: string;
  /** FLAT : même jour autorisé · NIGHTLY : sortie > entrée */
  allowSameDay?: boolean;
  onChange: (next: { checkInDate: string; checkOutDate: string }) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => startOfLocalToday(), []);

  const selected = useMemo<DateRange | undefined>(() => {
    const from = fromYmd(props.checkInDate);
    const to = fromYmd(props.checkOutDate);
    if (!from && !to) return undefined;
    return { from, to: to ?? from };
  }, [props.checkInDate, props.checkOutDate]);

  const label = useMemo(() => {
    const from = fromYmd(props.checkInDate);
    const to = fromYmd(props.checkOutDate);
    if (!from) return "Choisir la période…";
    if (!to || toYmd(from) === toYmd(to)) {
      return props.allowSameDay
        ? `${formatFrDay(from)} · passage`
        : formatFrDay(from);
    }
    return `${formatFrDay(from)} → ${formatFrDay(to)}`;
  }, [props.checkInDate, props.checkOutDate, props.allowSameDay]);

  function applyRange(range: DateRange | undefined) {
    if (!range?.from) {
      props.onChange({ checkInDate: "", checkOutDate: "" });
      return;
    }
    const from = toYmd(range.from);
    const to = range.to ? toYmd(range.to) : from;
    if (!props.allowSameDay && to === from) {
      // En nuitée, attendre le 2e clic (sortie)
      props.onChange({ checkInDate: from, checkOutDate: "" });
      return;
    }
    props.onChange({ checkInDate: from, checkOutDate: to });
    if (props.allowSameDay || (range.to && to !== from)) {
      setOpen(false);
    }
  }

  return (
    <div className={cn("grid gap-1.5", props.className)}>
      <Label>Période</Label>
      <Button
        type="button"
        variant="outline"
        className="h-10 justify-start gap-2 font-normal"
        onClick={() => setOpen(true)}
      >
        <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </Button>
      <p className="text-[11px] text-muted-foreground">
        {props.allowSameDay
          ? "Passage : un jour ou une plage · dates passées désactivées"
          : "Entrée → sortie · dates passées désactivées"}
      </p>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85vh] gap-3 overflow-y-auto rounded-t-2xl sm:max-w-none"
        >
          <SheetHeader className="text-left">
            <SheetTitle>Choisir la période</SheetTitle>
          </SheetHeader>
          <div className="flex justify-center px-1 pb-4">
            <DayPicker
              mode="range"
              locale={fr}
              selected={selected}
              onSelect={applyRange}
              disabled={{ before: today }}
              defaultMonth={selected?.from ?? today}
              numberOfMonths={1}
              className="rdp-root"
            />
          </div>
          <div className="flex gap-2 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                const t = toYmd(today);
                props.onChange({
                  checkInDate: t,
                  checkOutDate: props.allowSameDay
                    ? t
                    : toYmd(
                        new Date(
                          today.getFullYear(),
                          today.getMonth(),
                          today.getDate() + 1,
                        ),
                      ),
                });
                setOpen(false);
              }}
            >
              Aujourd’hui
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={
                !props.checkInDate ||
                !props.checkOutDate ||
                (!props.allowSameDay &&
                  props.checkOutDate <= props.checkInDate)
              }
              onClick={() => setOpen(false)}
            >
              Valider
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
