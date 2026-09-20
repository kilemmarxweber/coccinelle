"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Check, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/empty-state";
import {
  BoutiqueHero,
  BoutiqueKpis,
  BoutiquePage,
  BoutiquePanel,
  BoutiqueStatus,
} from "@/components/boutique/boutique-shell";
import {
  approveFactoryOrderRequestAction,
  rejectFactoryOrderRequestAction,
} from "@/lib/factory/actions";
import { branchDashboardPath, usineRoutes } from "@/lib/branch/paths";
import Link from "next/link";
import { cn } from "@/lib/utils";

type RequestLine = {
  id: string;
  shopProductId: string;
  nameSnapshot: string;
  qty: number;
  unitPriceUsd: number | null;
};

type RequestRow = {
  id: string;
  status: string;
  notes: string | null;
  deliveryAddress: string | null;
  deliveryCity: string | null;
  requestedDeliveryAt: Date | string | null;
  rejectReason: string | null;
  createdAt: Date | string;
  customer: {
    id: string;
    name: string;
    companyName: string | null;
    phone: string | null;
    contactName: string | null;
  };
  lines: RequestLine[];
  credit: { id: string; number: string } | null;
};

type FloatProduct = {
  id: string;
  name: string;
  price: number;
  free: number;
};

type ApproveLineDraft = {
  shopProductId: string;
  name: string;
  requestedQty: number;
  qty: number;
  unitPriceUsd: number;
  free: number;
  selected: boolean;
};

function defaultDueAt() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

function buildDraft(
  lines: RequestLine[],
  floatById: Map<string, FloatProduct>,
): ApproveLineDraft[] {
  return lines.map((l) => {
    const float = floatById.get(l.shopProductId);
    const free = float?.free ?? 0;
    const unitPriceUsd = l.unitPriceUsd ?? float?.price ?? 0;
    const qty = Math.min(l.qty, Math.max(0, free));
    return {
      shopProductId: l.shopProductId,
      name: l.nameSnapshot,
      requestedQty: l.qty,
      qty,
      unitPriceUsd,
      free,
      selected: qty > 0,
    };
  });
}

export function UsineDemandesClient(props: {
  organizationId: string;
  branchId: string;
  requests: RequestRow[];
  floatProducts: FloatProduct[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [dueAt, setDueAt] = useState(defaultDueAt);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  /** Brouillons d’approbation par demande (cases + quantités). */
  const [draftsByRequest, setDraftsByRequest] = useState<
    Record<string, ApproveLineDraft[]>
  >({});

  const floatById = useMemo(
    () => new Map(props.floatProducts.map((p) => [p.id, p])),
    [props.floatProducts],
  );

  const filtered = useMemo(() => {
    if (filter === "PENDING") {
      return props.requests.filter((r) => r.status === "PENDING");
    }
    return props.requests;
  }, [props.requests, filter]);

  const pendingCount = props.requests.filter((r) => r.status === "PENDING").length;

  function linesFor(request: RequestRow): ApproveLineDraft[] {
    return draftsByRequest[request.id] ?? buildDraft(request.lines, floatById);
  }

  function setLinesFor(
    requestId: string,
    updater: (prev: ApproveLineDraft[]) => ApproveLineDraft[],
  ) {
    setDraftsByRequest((prev) => {
      const base =
        prev[requestId] ??
        buildDraft(
          props.requests.find((r) => r.id === requestId)?.lines ?? [],
          floatById,
        );
      return { ...prev, [requestId]: updater(base) };
    });
  }

  function patchLine(
    requestId: string,
    shopProductId: string,
    patch: Partial<Pick<ApproveLineDraft, "qty" | "selected">>,
  ) {
    setLinesFor(requestId, (prev) =>
      prev.map((line) => {
        if (line.shopProductId !== shopProductId) return line;
        const next = { ...line, ...patch };
        if (typeof patch.qty === "number") {
          next.qty = Math.max(0, Math.min(line.free, Math.floor(patch.qty) || 0));
        }
        if (patch.selected === true) {
          next.selected = true;
          if (next.qty <= 0 && next.free > 0) {
            next.qty = Math.min(next.requestedQty, next.free);
          }
        }
        if (patch.selected === false) {
          next.selected = false;
        }
        if (next.qty <= 0) next.selected = false;
        else if (patch.qty !== undefined) next.selected = true;
        return next;
      }),
    );
  }

  function useRequestedQty(requestId: string, shopProductId: string) {
    setLinesFor(requestId, (prev) =>
      prev.map((line) => {
        if (line.shopProductId !== shopProductId) return line;
        if (line.free <= 0) {
          return { ...line, selected: false, qty: 0 };
        }
        const qty = Math.min(line.requestedQty, line.free);
        return { ...line, selected: true, qty };
      }),
    );
  }

  function selectAllRequested(requestId: string) {
    setLinesFor(requestId, (prev) =>
      prev.map((line) => {
        if (line.free <= 0) return { ...line, selected: false, qty: 0 };
        const qty = Math.min(line.requestedQty, line.free);
        return { ...line, selected: true, qty };
      }),
    );
  }

  function clearAll(requestId: string) {
    setLinesFor(requestId, (prev) =>
      prev.map((line) => ({ ...line, selected: false, qty: 0 })),
    );
  }

  function approve(requestId: string) {
    const draft = draftsByRequest[requestId] ??
      buildDraft(
        props.requests.find((r) => r.id === requestId)?.lines ?? [],
        floatById,
      );
    const lines = draft
      .filter((l) => l.selected && l.qty > 0)
      .map((l) => ({
        shopProductId: l.shopProductId,
        qty: l.qty,
        unitPriceUsd: l.unitPriceUsd,
      }));
    if (!lines.length) {
      toast.error("Cochez au moins un produit à livrer.");
      return;
    }
    start(async () => {
      try {
        const credit = await approveFactoryOrderRequestAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          requestId,
          dueAt,
          lines,
        });
        toast.success(`Demande validée · crédit ${credit.number}`);
        setDraftsByRequest((prev) => {
          const next = { ...prev };
          delete next[requestId];
          return next;
        });
        router.refresh();
        router.push(
          usineRoutes.credit(
            props.organizationId,
            props.branchId,
            credit.id,
          ) + "/document",
        );
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  function reject(requestId: string) {
    start(async () => {
      try {
        await rejectFactoryOrderRequestAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          requestId,
          reason: rejectReason,
        });
        toast.success("Demande refusée");
        setRejectReason("");
        setRejectId(null);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erreur");
      }
    });
  }

  return (
    <BoutiquePage>
      <BoutiqueHero
        kicker="Usine"
        title="Demandes affiliés"
        subtitle="Cochez les produits à livrer. Quantité = demande (ou modifiez selon le float)."
        icon={ClipboardList}
        backHref={branchDashboardPath(props.organizationId, props.branchId)}
      />
      <BoutiqueKpis
        items={[
          { label: "En attente", value: pendingCount },
          { label: "Total", value: props.requests.length },
        ]}
      />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={filter === "PENDING" ? "default" : "outline"}
            onClick={() => setFilter("PENDING")}
          >
            En attente
          </Button>
          <Button
            type="button"
            size="sm"
            variant={filter === "ALL" ? "default" : "outline"}
            onClick={() => setFilter("ALL")}
          >
            Toutes
          </Button>
        </div>
        <div className="grid gap-1">
          <Label htmlFor="due-at" className="text-xs">
            Échéance à l’approbation
          </Label>
          <Input
            id="due-at"
            type="date"
            className="h-9 w-[160px] rounded-xl"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Aucune demande"
          description="Les affiliés avec compte envoient leurs demandes depuis le portail."
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((r) => {
            const title = r.customer.companyName || r.customer.name;
            const delivery = [r.deliveryAddress, r.deliveryCity]
              .filter(Boolean)
              .join(", ");
            const draft = r.status === "PENDING" ? linesFor(r) : null;
            const selectedCount =
              draft?.filter((l) => l.selected && l.qty > 0).length ?? 0;

            return (
              <BoutiquePanel
                key={r.id}
                title={title}
                eyebrow={r.status}
                bodyClassName="grid gap-3 p-4"
                actions={<BoutiqueStatus>{r.status}</BoutiqueStatus>}
              >
                <p className="text-sm text-muted-foreground">
                  {[r.customer.contactName, r.customer.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                {r.status === "PENDING" && draft ? (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                        Produits à livrer
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => selectAllRequested(r.id)}
                      >
                        Tout (qté demandée)
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => clearAll(r.id)}
                      >
                        Tout décocher
                      </Button>
                    </div>
                    <ul className="grid gap-2">
                      {draft.map((line) => {
                        const partial =
                          line.selected &&
                          line.qty > 0 &&
                          line.qty < line.requestedQty;
                        return (
                          <li
                            key={line.shopProductId}
                            className={cn(
                              "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-3 py-2.5",
                              line.selected
                                ? "border-primary/40 ring-1 ring-primary/15"
                                : "border-border",
                              line.free <= 0 && "opacity-70",
                            )}
                          >
                            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                              <Checkbox
                                checked={line.selected}
                                disabled={line.free <= 0}
                                onCheckedChange={(v) =>
                                  patchLine(r.id, line.shopProductId, {
                                    selected: v === true,
                                  })
                                }
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-medium">
                                  {line.name}
                                </span>
                                <span className="block text-[11px] text-muted-foreground">
                                  float {line.free}
                                  {line.free <= 0
                                    ? " · indisponible"
                                    : partial
                                      ? " · partielle"
                                      : ""}
                                </span>
                              </span>
                            </label>

                            <div className="flex shrink-0 flex-wrap items-center gap-2">
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                À livrer
                              </span>
                              <div className="inline-flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5">
                                <button
                                  type="button"
                                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
                                  disabled={!line.selected || line.qty <= 0}
                                  onClick={() =>
                                    patchLine(r.id, line.shopProductId, {
                                      qty: line.qty - 1,
                                    })
                                  }
                                  aria-label="Diminuer"
                                >
                                  <Minus className="size-3.5" />
                                </button>
                                <Input
                                  type="number"
                                  min={0}
                                  max={line.free}
                                  disabled={!line.selected || line.free <= 0}
                                  value={line.selected ? line.qty : 0}
                                  onChange={(e) =>
                                    patchLine(r.id, line.shopProductId, {
                                      qty: Number(e.target.value),
                                    })
                                  }
                                  className="h-7 w-12 border-0 bg-transparent px-0 text-center text-sm tabular-nums shadow-none focus-visible:ring-0"
                                />
                                <button
                                  type="button"
                                  className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted disabled:opacity-40"
                                  disabled={
                                    !line.selected || line.qty >= line.free
                                  }
                                  onClick={() =>
                                    patchLine(r.id, line.shopProductId, {
                                      qty: line.qty + 1,
                                    })
                                  }
                                  aria-label="Augmenter"
                                >
                                  <Plus className="size-3.5" />
                                </button>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-7 whitespace-nowrap px-2 text-xs"
                                disabled={line.free <= 0}
                                onClick={() =>
                                  useRequestedQty(r.id, line.shopProductId)
                                }
                              >
                                Qté demandée ({line.requestedQty})
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-xs text-muted-foreground">
                      {selectedCount} produit{selectedCount > 1 ? "s" : ""}{" "}
                      sélectionné{selectedCount > 1 ? "s" : ""} pour la
                      livraison.
                    </p>
                  </div>
                ) : (
                  <ul className="text-sm">
                    {r.lines.map((l) => (
                      <li key={l.id}>
                        {l.qty}× {l.nameSnapshot}
                        {l.unitPriceUsd != null
                          ? ` · ${l.unitPriceUsd.toFixed(2)} USD`
                          : ""}
                      </li>
                    ))}
                  </ul>
                )}

                {delivery ? (
                  <p className="text-sm">Livraison : {delivery}</p>
                ) : null}
                {r.requestedDeliveryAt ? (
                  <p className="text-sm">
                    Souhaitée le{" "}
                    {new Date(r.requestedDeliveryAt).toLocaleDateString("fr-CD")}
                  </p>
                ) : null}
                {r.notes ? (
                  <p className="text-sm text-muted-foreground">Note : {r.notes}</p>
                ) : null}
                {r.credit ? (
                  <Link
                    className="text-sm font-medium underline"
                    href={
                      usineRoutes.credit(
                        props.organizationId,
                        props.branchId,
                        r.credit.id,
                      ) + "/document"
                    }
                  >
                    Crédit {r.credit.number}
                  </Link>
                ) : null}
                {r.rejectReason ? (
                  <p className="text-sm text-destructive">
                    Refus : {r.rejectReason}
                  </p>
                ) : null}

                {r.status === "PENDING" ? (
                  <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                    <Button
                      disabled={pending || selectedCount === 0}
                      onClick={() => approve(r.id)}
                      className="gap-1.5"
                    >
                      <Check className="size-4" />
                      Approuver ({selectedCount})
                    </Button>
                    {rejectId === r.id ? (
                      <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
                        <div className="grid min-w-[200px] flex-1 gap-1">
                          <Label htmlFor={`reject-${r.id}`} className="text-xs">
                            Motif
                          </Label>
                          <Input
                            id={`reject-${r.id}`}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Motif du refus"
                            className="h-9 rounded-xl"
                          />
                        </div>
                        <Button
                          variant="destructive"
                          disabled={pending}
                          onClick={() => reject(r.id)}
                          className="gap-1.5"
                        >
                          <X className="size-4" />
                          Confirmer refus
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() => {
                          setRejectId(r.id);
                          setRejectReason("");
                        }}
                      >
                        Refuser
                      </Button>
                    )}
                  </div>
                ) : null}
              </BoutiquePanel>
            );
          })}
        </div>
      )}
    </BoutiquePage>
  );
}
