"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, CalendarDays, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BoutiqueHero,
  BoutiqueKpis,
  BoutiquePage,
  BoutiquePanel,
  BoutiqueStatus,
  boutiqueOutlineBtn,
  boutiquePrimaryBtn,
} from "@/components/boutique/boutique-shell";
import { branchDashboardPath } from "@/lib/branch/paths";
import { EmptyState } from "@/components/ui/empty-state";
import {
  cancelFactoryReservationAction,
  createFactoryReservationAction,
  pickFactoryReservationAction,
} from "@/lib/factory/actions";
import { cn } from "@/lib/utils";

type Reservation = {
  id: string;
  status: string;
  holdUntil: Date | string;
  customer: { name: string };
  lines: { qty: number; shopProduct: { name: string } }[];
};

const STATUS: Record<
  string,
  { label: string; tone: "ok" | "warn" | "danger" | "neutral" | "info" }
> = {
  HOLD: { label: "En hold", tone: "info" },
  PICKED: { label: "Retiré", tone: "ok" },
  CANCELLED: { label: "Annulé", tone: "neutral" },
  EXPIRED: { label: "Expiré", tone: "warn" },
};

function QtyStepper(props: {
  quantity: number;
  max: number;
  onChange: (qty: number) => void;
}) {
  const { quantity, max, onChange } = props;
  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-40"
        disabled={quantity <= 0}
        onClick={(e) => {
          e.stopPropagation();
          onChange(quantity - 1);
        }}
        aria-label="Diminuer"
      >
        <Minus className="size-3.5" />
      </button>
      <span className="min-w-7 text-center text-sm font-semibold tabular-nums">
        {quantity}
      </span>
      <button
        type="button"
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-40"
        disabled={quantity >= max}
        onClick={(e) => {
          e.stopPropagation();
          onChange(quantity + 1);
        }}
        aria-label="Augmenter"
      >
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}

export function UsineReservationsClient(props: {
  organizationId: string;
  branchId: string;
  reservations: Reservation[];
  customers: { id: string; name: string }[];
  products: { id: string; name: string; free: number }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [customerId, setCustomerId] = useState(props.customers[0]?.id ?? "");
  const [qtys, setQtys] = useState<Record<string, number>>({});

  const lines = useMemo(
    () =>
      props.products
        .filter((p) => (qtys[p.id] ?? 0) > 0)
        .map((p) => ({
          id: p.id,
          name: p.name,
          qty: qtys[p.id] ?? 0,
          free: p.free,
        })),
    [props.products, qtys],
  );

  function setQty(id: string, qty: number, max: number) {
    const next = Math.max(0, Math.min(max, Math.floor(qty)));
    setQtys((prev) => {
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  }

  function addOne(id: string, max: number) {
    setQtys((prev) => {
      const current = prev[id] ?? 0;
      if (current >= max) return prev;
      return { ...prev, [id]: current + 1 };
    });
  }

  const holds = props.reservations.filter((r) => r.status === "HOLD").length;

  return (
    <BoutiquePage wide>
      <BoutiqueHero
        kicker="Usine"
        title="Réservations"
        subtitle="Hold 7 jours sur le float libre — dette ou pas. Le client retire ou vous annulez."
        icon={CalendarDays}
        backHref={branchDashboardPath(props.organizationId, props.branchId)}
      />
      <BoutiqueKpis
        items={[
          { label: "Holds", value: holds, tone: holds ? "warn" : "ok" },
          { label: "Dossiers", value: props.reservations.length },
          {
            label: "Produits libres",
            value: props.products.filter((p) => p.free > 0).length,
          },
        ]}
      />

      <form
        className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,380px)]"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            try {
              await createFactoryReservationAction({
                organizationId: props.organizationId,
                branchId: props.branchId,
                customerId,
                lines: lines.map((l) => ({
                  shopProductId: l.id,
                  qty: l.qty,
                })),
              });
              toast.success("Réservation créée");
              setQtys({});
              router.refresh();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Erreur");
            }
          });
        }}
      >
        <BoutiquePanel
          title="Float libre"
          eyebrow="Catalogue"
          bodyClassName="p-0"
        >
          {props.products.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              Ouvrez le float marketeur pour réserver.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-border lg:hidden">
                {props.products.map((p) => {
                  const qty = qtys[p.id] ?? 0;
                  const soldOut = p.free <= 0 || qty >= p.free;
                  return (
                    <li
                      key={p.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-3 transition",
                        soldOut && qty === 0
                          ? "opacity-50"
                          : "cursor-pointer hover:bg-muted",
                      )}
                      onClick={() => addOne(p.id, p.free)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {p.name}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Libre {p.free}
                        </p>
                      </div>
                      {qty > 0 ? (
                        <QtyStepper
                          quantity={qty}
                          max={p.free}
                          onChange={(n) => setQty(p.id, n, p.free)}
                        />
                      ) : (
                        <button
                          type="button"
                          disabled={p.free <= 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            addOne(p.id, p.free);
                          }}
                          className="flex size-9 items-center justify-center rounded-xl border border-border bg-white hover:bg-muted disabled:opacity-40"
                          aria-label="Ajouter"
                        >
                          <Plus className="size-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Produit</TableHead>
                      <TableHead className="text-right">Libre</TableHead>
                      <TableHead className="w-[130px] text-right">
                        Qté
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {props.products.map((p) => {
                      const qty = qtys[p.id] ?? 0;
                      const soldOut = p.free <= 0 || qty >= p.free;
                      return (
                        <TableRow
                          key={p.id}
                          className={cn(
                            soldOut && qty === 0
                              ? "opacity-50"
                              : "cursor-pointer",
                          )}
                          onClick={() => addOne(p.id, p.free)}
                        >
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {p.free}
                          </TableCell>
                          <TableCell
                            className="text-right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {qty > 0 ? (
                              <div className="flex justify-end">
                                <QtyStepper
                                  quantity={qty}
                                  max={p.free}
                                  onChange={(n) => setQty(p.id, n, p.free)}
                                />
                              </div>
                            ) : (
                              <button
                                type="button"
                                disabled={p.free <= 0}
                                onClick={() => addOne(p.id, p.free)}
                                className="inline-flex size-8 items-center justify-center rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-40"
                                aria-label="Ajouter"
                              >
                                <Plus className="size-4" />
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </BoutiquePanel>

        <BoutiquePanel
          className="lg:sticky lg:top-4"
          title="Nouvelle réservation"
          icon={Bookmark}
          bodyClassName="space-y-3 p-4"
        >
          {props.customers.length === 0 ? (
            <p className="text-sm text-amber-800">
              Aucun client. Créez d’abord une fiche dans Clients.
            </p>
          ) : (
            <div className="grid gap-1.5">
              <Label htmlFor="res-customer">Client</Label>
              <Select
                id="res-customer"
                className="h-10 rounded-xl"
                value={customerId}
                required
                onChange={(e) => setCustomerId(e.target.value)}
              >
                {props.customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
              Choisissez des quantités dans le catalogue.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {lines.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">
                    {l.name}{" "}
                    <span className="text-muted-foreground">× {l.qty}</span>
                  </span>
                  <button
                    type="button"
                    className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-rose-500/10 hover:text-rose-700"
                    onClick={() => setQty(l.id, 0, l.free)}
                    aria-label="Retirer"
                  >
                    <X className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Button
            type="submit"
            disabled={pending || !lines.length || !customerId}
            className={cn(boutiquePrimaryBtn(), "h-12 w-full rounded-2xl")}
          >
            Réserver 7 jours
          </Button>
        </BoutiquePanel>
      </form>

      {props.reservations.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="Aucune réservation"
          description="Choisissez un client et des quantités, puis réservez 7 jours."
        />
      ) : (
        <>
          <ul className="space-y-3 lg:hidden">
            {props.reservations.map((r) => {
              const st = STATUS[r.status] ?? {
                label: r.status,
                tone: "neutral" as const,
              };
              return (
                <li
                  key={r.id}
                  className="rounded-2xl border border-border bg-card p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">
                        {r.customer.name}
                      </p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {r.lines
                          .map((l) => `${l.qty}× ${l.shopProduct.name}`)
                          .join(", ")}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        jusqu’au{" "}
                        {new Date(r.holdUntil).toLocaleDateString("fr-CD")}
                      </p>
                    </div>
                    <BoutiqueStatus tone={st.tone}>{st.label}</BoutiqueStatus>
                  </div>
                  {r.status === "HOLD" ? (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className={boutiquePrimaryBtn("h-8")}
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            try {
                              await pickFactoryReservationAction({
                                organizationId: props.organizationId,
                                branchId: props.branchId,
                                reservationId: r.id,
                              });
                              router.refresh();
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Erreur",
                              );
                            }
                          })
                        }
                      >
                        Retiré
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className={boutiqueOutlineBtn("h-8")}
                        disabled={pending}
                        onClick={() =>
                          start(async () => {
                            try {
                              await cancelFactoryReservationAction({
                                organizationId: props.organizationId,
                                branchId: props.branchId,
                                reservationId: r.id,
                              });
                              router.refresh();
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Erreur",
                              );
                            }
                          })
                        }
                      >
                        Annuler
                      </Button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <BoutiquePanel
            className="hidden lg:block"
            title="Holds en cours"
            bodyClassName="p-0"
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Client</TableHead>
                  <TableHead>Produits</TableHead>
                  <TableHead>Jusqu’au</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.reservations.map((r) => {
                  const st = STATUS[r.status] ?? {
                    label: r.status,
                    tone: "neutral" as const,
                  };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.customer.name}
                      </TableCell>
                      <TableCell className="max-w-[280px] whitespace-normal text-muted-foreground">
                        {r.lines
                          .map((l) => `${l.qty}× ${l.shopProduct.name}`)
                          .join(", ")}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {new Date(r.holdUntil).toLocaleDateString("fr-CD")}
                      </TableCell>
                      <TableCell>
                        <BoutiqueStatus tone={st.tone}>{st.label}</BoutiqueStatus>
                      </TableCell>
                      <TableCell>
                        {r.status === "HOLD" ? (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              className={boutiquePrimaryBtn("h-8")}
                              disabled={pending}
                              onClick={() =>
                                start(async () => {
                                  try {
                                    await pickFactoryReservationAction({
                                      organizationId: props.organizationId,
                                      branchId: props.branchId,
                                      reservationId: r.id,
                                    });
                                    router.refresh();
                                  } catch (err) {
                                    toast.error(
                                      err instanceof Error
                                        ? err.message
                                        : "Erreur",
                                    );
                                  }
                                })
                              }
                            >
                              Retiré
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className={boutiqueOutlineBtn("h-8")}
                              disabled={pending}
                              onClick={() =>
                                start(async () => {
                                  try {
                                    await cancelFactoryReservationAction({
                                      organizationId: props.organizationId,
                                      branchId: props.branchId,
                                      reservationId: r.id,
                                    });
                                    router.refresh();
                                  } catch (err) {
                                    toast.error(
                                      err instanceof Error
                                        ? err.message
                                        : "Erreur",
                                    );
                                  }
                                })
                              }
                            >
                              Annuler
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </BoutiquePanel>
        </>
      )}
    </BoutiquePage>
  );
}
