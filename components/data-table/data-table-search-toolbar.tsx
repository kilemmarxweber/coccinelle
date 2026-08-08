"use client";

import type { Table } from "@tanstack/react-table";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function DataTableSearchToolbar<TData>(props: {
  table: Table<TData>;
  placeholder?: string;
  columnId?: string;
}) {
  const columnId = props.columnId ?? "search";
  const column = props.table.getColumn(columnId);
  const value = (column?.getFilterValue() as string) ?? "";

  return (
    <div className="relative max-w-sm">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => column?.setFilterValue(e.target.value)}
        placeholder={props.placeholder ?? "Rechercher…"}
        className="h-9 pl-8"
      />
    </div>
  );
}
