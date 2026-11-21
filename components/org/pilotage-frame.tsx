"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown, FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";

export function PilotageFrame(props: {
  backHref: string;
  kicker: string;
  title: string;
  subtitle: string;
  onPdf: () => void;
  onExcel: () => void;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex h-[calc(100svh-5.5rem)] max-h-[calc(100svh-5.5rem)] w-full max-w-7xl flex-col gap-3 overflow-y-auto px-4 pb-3 sm:px-6">
      <header className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={props.backHref}
            className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            Organisation
          </Link>
          <p className="text-[11px] font-semibold tracking-wide text-[#157a3c] uppercase">
            {props.kicker}
          </p>
          <h1 className="text-xl font-semibold tracking-tight">{props.title}</h1>
          <p className="text-sm text-muted-foreground">{props.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={props.onPdf}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-sm font-medium hover:bg-muted"
          >
            <FileDown className="size-4" />
            PDF
          </button>
          <button
            type="button"
            onClick={props.onExcel}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1b9a4b] px-3 text-sm font-medium text-white hover:bg-[#157a3c]"
          >
            <FileSpreadsheet className="size-4" />
            Excel
          </button>
        </div>
      </header>
      {props.children}
    </div>
  );
}

export function PilotageKpis(props: {
  items: { label: string; value: string; hint?: string; tone?: "green" | "alert" }[];
}) {
  return (
    <section className="grid shrink-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {props.items.map((item) => (
        <article
          key={item.label}
          className={cn(
            "rounded-xl border px-3 py-2.5 shadow-sm",
            item.tone === "alert"
              ? "border-[#ffe0c2] bg-[#fff8f1]"
              : "border-[#d7f0e1] bg-[#f3fbf6]",
          )}
        >
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums">{item.value}</p>
          {item.hint ? (
            <p className="text-[11px] text-muted-foreground">{item.hint}</p>
          ) : null}
        </article>
      ))}
    </section>
  );
}

export function PilotageTable(props: {
  title: string;
  headers: string[];
  children: ReactNode;
  className?: string;
  toolbar?: ReactNode;
  /** Le tableau grandit avec ses lignes : un seul défilement, celui de la page. */
  flow?: boolean;
  /** Largeurs de colonnes, en %. Le tableau reste dans la carte, sans défilement horizontal. */
  widths?: string[];
}) {
  const fitted = Boolean(props.widths?.length);
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        props.flow ? "shrink-0" : "min-h-0 flex-1",
        props.className,
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
        {props.title ? <h2 className="text-sm font-semibold">{props.title}</h2> : null}
        {props.toolbar}
      </div>
      <div
        className={cn(
          props.flow
            ? "overflow-x-hidden"
            : cn("min-h-0 flex-1", fitted ? "overflow-y-auto overflow-x-hidden" : "overflow-auto"),
        )}
      >
        <table
          className={cn(
            "w-full border-separate border-spacing-0 text-left text-sm",
            fitted ? "table-fixed" : "min-w-[720px]",
          )}
        >
          <thead className="sticky top-0 z-10 bg-[#f3fbf6] text-[11px] tracking-wide text-[#157a3c] uppercase">
            <tr>
              {props.headers.map((header, index) => (
                <th
                  key={header}
                  style={fitted ? { width: props.widths?.[index] } : undefined}
                  className={cn("px-3 py-2 font-semibold", fitted ? "truncate" : "whitespace-nowrap")}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="[&_td]:border-b [&_td]:border-border [&_td]:px-3 [&_td]:py-2 [&_tr:hover]:bg-[#f7fbf8]">
            {props.children}
          </tbody>
        </table>
      </div>
    </section>
  );
}
