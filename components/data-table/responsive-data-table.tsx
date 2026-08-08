"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type Table as TanstackTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ResponsiveDataTableProps<TData, TValue> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyText?: string;
  ToolbarComponent?: React.ComponentType<{ table: TanstackTable<TData> }>;
  mobileCardTitle?: (row: TData) => string;
  mobileCardSubtitle?: (row: TData) => string;
  mobileCardActions?: (row: TData) => React.ReactNode;
  mobileCardBadges?: (
    row: TData,
  ) => {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  }[];
  onRowClick?: (row: TData) => void;
  enableRowSelection?: boolean;
  className?: string;
  pageSize?: number;
};

export function ResponsiveDataTable<TData, TValue>({
  columns,
  data,
  emptyText = "Aucune donnée.",
  ToolbarComponent,
  mobileCardTitle,
  mobileCardSubtitle,
  mobileCardActions,
  mobileCardBadges,
  onRowClick,
  enableRowSelection = false,
  className,
  pageSize = 10,
}: ResponsiveDataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    [],
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const table = useReactTable({
    data,
    columns,
    initialState: {
      pagination: { pageSize },
    },
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  function handleRowNavigate(
    event: React.MouseEvent<HTMLElement>,
    row: TData,
  ) {
    if (!onRowClick) return;
    const target = event.target as HTMLElement;
    if (
      target.closest(
        'button, a, input, label, [role="checkbox"], [role="menuitem"], [data-no-row-nav="true"]',
      )
    ) {
      return;
    }
    onRowClick(row);
  }

  const MobileCardView = () => (
    <div className="space-y-3">
      {table.getRowModel().rows?.length ? (
        table.getRowModel().rows.map((row) => {
          const rowData = row.original;
          return (
            <Card
              key={row.id}
              size="sm"
              className={cn(
                "transition-all hover:shadow-md",
                onRowClick && "cursor-pointer",
              )}
              onClick={(event) => handleRowNavigate(event, rowData)}
            >
              <CardHeader className="border-b">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-base font-semibold">
                      {mobileCardTitle
                        ? mobileCardTitle(rowData)
                        : `Ligne ${row.id}`}
                    </CardTitle>
                    {mobileCardSubtitle ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {mobileCardSubtitle(rowData)}
                      </p>
                    ) : null}
                  </div>
                </div>
                {mobileCardBadges ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {mobileCardBadges(rowData).map((badge, index) => (
                      <Badge
                        key={`${badge.label}-${index}`}
                        variant={badge.variant || "secondary"}
                      >
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {row.getVisibleCells().map((cell) => {
                    const columnDef = cell.column.columnDef;
                    if (
                      columnDef.id === "actions" ||
                      columnDef.id === "select"
                    ) {
                      return null;
                    }
                    const headerLabel =
                      typeof columnDef.header === "string"
                        ? columnDef.header
                        : columnDef.id
                            ?.replace(/([A-Z])/g, " $1")
                            .trim() || "Champ";
                    return (
                      <div
                        key={cell.id}
                        className="flex items-start justify-between gap-3 py-1"
                      >
                        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                          {headerLabel}
                        </span>
                        <span className="text-right text-sm">
                          {flexRender(columnDef.cell, cell.getContext())}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {mobileCardActions ? (
                  <div
                    className="mt-4 flex flex-wrap gap-2 border-t pt-3"
                    data-no-row-nav="true"
                  >
                    {mobileCardActions(rowData)}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          );
        })
      ) : (
        <Card size="sm">
          <CardContent className="flex h-28 items-center justify-center">
            <p className="text-center text-muted-foreground">{emptyText}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );

  const DesktopTableView = () => (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/40 hover:bg-muted/40">
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} colSpan={header.colSpan}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() && "selected"}
                className={cn(
                  "hover:bg-muted/40",
                  onRowClick && "cursor-pointer",
                )}
                onClick={(event) => handleRowNavigate(event, row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                {emptyText}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className={cn("space-y-4", className)}>
      {ToolbarComponent ? <ToolbarComponent table={table} /> : null}
      {isMobile ? <MobileCardView /> : <DesktopTableView />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {enableRowSelection
            ? `${table.getFilteredSelectedRowModel().rows.length} / ${table.getFilteredRowModel().rows.length} sélectionnée(s)`
            : `${table.getFilteredRowModel().rows.length} ligne(s)`}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Précédent
          </Button>
          <span className="text-sm tabular-nums">
            {table.getState().pagination.pageIndex + 1} /{" "}
            {Math.max(1, table.getPageCount())}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Suivant
          </Button>
        </div>
      </div>
    </div>
  );
}
