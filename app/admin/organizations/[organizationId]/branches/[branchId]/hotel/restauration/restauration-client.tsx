"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ResponsiveDataTable } from "@/components/data-table/responsive-data-table";
import {
  PosChargeButton,
  PosTerminal,
  usePosCart,
} from "@/components/pos/pos-terminal";
import {
  advanceHotelOrderAction,
  createHotelOrderAction,
} from "@/lib/hotel/actions";
import { cn } from "@/lib/utils";

type MenuItem = {
  id: string;
  name: string;
  category: string;
  price: number;
  needsKitchen: boolean;
};

type Order = {
  id: string;
  tableLabel: string | null;
  status: string;
  items: { name: string; quantity: number; amount: number }[];
};

const STATUS_RANK: Record<string, number> = {
  PAYEE: 0,
  PRETE: 1,
  EN_CAISSE: 2,
  EN_PREPARATION: 3,
  ENVOYEE: 4,
  LIVREE: 5,
};

export function RestaurationClient(props: {
  organizationId: string;
  branchId: string;
  menuItems: MenuItem[];
  orders: Order[];
  initialView?: "commande" | "suivi";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [tableLabel, setTableLabel] = useState("T1");
  const toDeliverCount = props.orders.filter((o) => o.status === "PAYEE").length;
  const [view, setView] = useState<"commande" | "suivi">(
    props.initialView === "suivi" || toDeliverCount > 0 ? "suivi" : "commande",
  );
  const [suiviFilter, setSuiviFilter] = useState<"actives" | "livrer" | "toutes">(
    toDeliverCount > 0 ? "livrer" : "actives",
  );
  const { cart, addItem, setQty, clear, toPayload } = usePosCart();

  const toDeliver = useMemo(
    () => props.orders.filter((o) => o.status === "PAYEE"),
    [props.orders],
  );
  const activeOrders = useMemo(
    () =>
      props.orders.filter(
        (o) => o.status !== "LIVREE" && o.status !== "ANNULEE",
      ),
    [props.orders],
  );

  useEffect(() => {
    if (searchParams.get("view") === "suivi") {
      setView("suivi");
      if (toDeliver.length > 0) setSuiviFilter("livrer");
    }
  }, [searchParams, toDeliver.length]);

  const suiviRows = useMemo(() => {
    let rows = props.orders;
    if (suiviFilter === "actives") {
      rows = activeOrders;
    } else if (suiviFilter === "livrer") {
      rows = toDeliver;
    }
    return [...rows].sort(
      (a, b) =>
        (STATUS_RANK[a.status] ?? 99) - (STATUS_RANK[b.status] ?? 99),
    );
  }, [props.orders, suiviFilter, activeOrders, toDeliver]);

  function send() {
    const items = toPayload();
    if (!items.length) {
      toast.message("Ajoutez des articles");
      return;
    }
    start(async () => {
      try {
        await createHotelOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          tableLabel,
          items,
        });
        toast.success("Commande envoyée");
        clear();
        router.refresh();
        setView("suivi");
        setSuiviFilter("actives");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  function markDelivered(orderId: string) {
    start(async () => {
      try {
        await advanceHotelOrderAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          orderId,
          to: "LIVREE",
        });
        toast.success("Livrée");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Erreur");
      }
    });
  }

  const columns = useMemo<ColumnDef<Order>[]>(
    () => [
      {
        accessorKey: "tableLabel",
        header: "Table",
        cell: ({ row }) => (
          <span className="font-medium">
            {row.original.tableLabel ?? "Salle"}
          </span>
        ),
      },
      {
        id: "articles",
        header: "Articles",
        cell: ({ row }) =>
          row.original.items.map((i) => `${i.quantity}× ${i.name}`).join(", "),
      },
      {
        accessorKey: "status",
        header: "Statut",
        cell: ({ row }) => (
          <Badge
            variant={row.original.status === "PAYEE" ? "default" : "secondary"}
          >
            {row.original.status === "PAYEE"
              ? "À livrer"
              : row.original.status}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.status === "PAYEE" ? (
            <Button
              size="sm"
              disabled={pending}
              onClick={() => markDelivered(row.original.id)}
            >
              Marquer livrée
            </Button>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pending],
  );

  const suiviBadge = toDeliver.length > 0 ? toDeliver.length : activeOrders.length;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 py-5 sm:px-5 lg:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-500">
            <UtensilsCrossed className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Restauration</h1>
            <p className="text-sm text-muted-foreground">
              Serveur — catalogue tactile + ticket, puis suivi livraison.
            </p>
          </div>
        </div>
        {toDeliver.length > 0 ? (
          <Badge className="gap-1.5 px-3 py-1 text-sm">
            {toDeliver.length} à livrer
          </Badge>
        ) : null}
      </header>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1">
        {(
          [
            ["commande", "Nouvelle commande"],
            [
              "suivi",
              toDeliver.length > 0
                ? `Suivi · ${toDeliver.length} à livrer`
                : `Suivi (${activeOrders.length})`,
            ],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            className={cn(
              "shrink-0 rounded-lg px-3.5 py-2 text-sm font-medium transition",
              view === id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              id === "suivi" &&
                toDeliver.length > 0 &&
                view !== "suivi" &&
                "ring-1 ring-primary/40",
            )}
          >
            {label}
            {id === "suivi" && suiviBadge > 0 && view !== "suivi" ? (
              <span className="ml-1.5 inline-flex min-w-5 justify-center rounded-full bg-primary/15 px-1.5 text-xs font-bold text-primary">
                {suiviBadge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {view === "commande" ? (
        <PosTerminal
          items={props.menuItems}
          cart={cart}
          onAdd={addItem}
          onSetQty={setQty}
          onClear={clear}
          ticketTitle="Ticket serveur"
          emptyHint="Touchez un plat ou une boisson pour composer le ticket"
          ticketMeta={
            <div className="grid gap-1.5">
              <Label htmlFor="table">Table / chambre</Label>
              <Input
                id="table"
                value={tableLabel}
                onChange={(e) => setTableLabel(e.target.value)}
                placeholder="T1, Ch. 12…"
              />
            </div>
          }
          actions={
            <PosChargeButton
              label="Envoyer la commande"
              pending={pending}
              disabled={cart.length === 0}
              onClick={send}
            />
          }
        />
      ) : (
        <section className="space-y-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold">Suivi des commandes</h2>
            <div className="flex gap-1 rounded-lg border border-border bg-muted/20 p-1">
              {(
                [
                  ["livrer", `À livrer (${toDeliver.length})`],
                  ["actives", `En cours (${activeOrders.length})`],
                  ["toutes", "Toutes"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSuiviFilter(id)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                    suiviFilter === id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveDataTable
            columns={columns}
            data={suiviRows}
            emptyText={
              suiviFilter === "livrer"
                ? "Aucune commande à livrer."
                : "Aucune commande pour le moment."
            }
            mobileCardTitle={(row) => row.tableLabel ?? "Salle"}
            mobileCardSubtitle={(row) =>
              row.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")
            }
            mobileCardBadges={(row) => [
              {
                label: row.status === "PAYEE" ? "À livrer" : row.status,
                variant: row.status === "PAYEE" ? "default" : "secondary",
              },
            ]}
            mobileCardActions={(row) =>
              row.status === "PAYEE" ? (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => markDelivered(row.id)}
                >
                  Marquer livrée
                </Button>
              ) : null
            }
          />
        </section>
      )}
    </div>
  );
}
