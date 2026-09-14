"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  lines: { id: string; nameSnapshot: string; qty: number; unitPriceUsd: number | null }[];
  credit: { id: string; number: string } | null;
};

function defaultDueAt() {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function UsineDemandesClient(props: {
  organizationId: string;
  branchId: string;
  requests: RequestRow[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [filter, setFilter] = useState<"PENDING" | "ALL">("PENDING");
  const [dueAt, setDueAt] = useState(defaultDueAt);
  const [rejectReason, setRejectReason] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (filter === "PENDING") {
      return props.requests.filter((r) => r.status === "PENDING");
    }
    return props.requests;
  }, [props.requests, filter]);

  const pendingCount = props.requests.filter((r) => r.status === "PENDING").length;

  function approve(requestId: string) {
    start(async () => {
      try {
        const credit = await approveFactoryOrderRequestAction({
          organizationId: props.organizationId,
          branchId: props.branchId,
          requestId,
          dueAt,
        });
        toast.success(`Demande validée · crédit ${credit.number}`);
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
        setActiveId(null);
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
        subtitle="Commandes / livraisons demandées en ligne — validation marketeur."
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
                      disabled={pending}
                      onClick={() => approve(r.id)}
                      className="gap-1.5"
                    >
                      <Check className="size-4" />
                      Approuver → crédit
                    </Button>
                    {activeId === r.id ? (
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
                          setActiveId(r.id);
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
