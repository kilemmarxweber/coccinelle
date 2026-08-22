"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  printWarehouseSlipAction,
  receiveWarehouseSlipAction,
  type PendingPosReception,
} from "@/lib/warehouse/actions";
import { openPrintHtml } from "@/lib/warehouse/open-print-html";

export function PosReceptionBanner(props: {
  organizationId: string;
  branchId: string;
  pending: PendingPosReception[];
}) {
  const router = useRouter();
  const [pendingUi, start] = useTransition();
  const [slip, setSlip] = useState<PendingPosReception | null>(null);
  const [signature, setSignature] = useState("");
  const [note, setNote] = useState("");

  if (props.pending.length === 0) return null;

  function printDoc(html: string) {
    try {
      openPrintHtml(html);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Impression impossible");
    }
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-primary/40 bg-card shadow-sm">
        <div className="h-1 w-full bg-primary" />
        <div className="px-4 py-3">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <PackageCheck className="size-4 text-primary" />
            {props.pending.length} envoi(s) du stock principal à réceptionner
          </p>
          <ul className="space-y-2">
            {props.pending.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-sm"
              >
                <div>
                  <p className="font-semibold">{s.number}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.items
                      .map(
                        (i) =>
                          `${i.name}${i.sku ? ` (${i.sku})` : ""} ×${i.quantity}`,
                      )
                      .join(" · ")}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full"
                    disabled={pendingUi}
                    onClick={() =>
                      start(async () => {
                        try {
                          const html = await printWarehouseSlipAction({
                            organizationId: props.organizationId,
                            branchId: props.branchId,
                            slipId: s.id,
                            document: "envoi",
                          });
                          printDoc(html);
                        } catch (e) {
                          toast.error(
                            e instanceof Error ? e.message : "Erreur",
                          );
                        }
                      })
                    }
                  >
                    <Printer className="size-3.5" /> Envoi
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => {
                      setSlip(s);
                      setSignature("");
                      setNote("");
                    }}
                  >
                    Réceptionner
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <Dialog open={Boolean(slip)} onOpenChange={() => setSlip(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réception {slip?.number}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Contrôlez les quantités, signez, puis le stock auxiliaire (dépôt POS)
            est crédité. Pour vendre, attribuez-le au float via Service stock.
          </p>
          <ul className="text-sm">
            {slip?.items.map((i, idx) => (
              <li key={`${i.name}-${idx}`}>
                {i.name}
                {i.sku ? ` · ${i.sku}` : ""} ×{i.quantity}
              </li>
            ))}
          </ul>
          <div className="grid gap-1.5">
            <Label>Signature (nom complet)</Label>
            <Input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Prénom Nom"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>Note (optionnel)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlip(null)}>
              Annuler
            </Button>
            <Button
              className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={pendingUi}
              onClick={() => {
                if (!slip) return;
                start(async () => {
                  try {
                    const res = await receiveWarehouseSlipAction({
                      organizationId: props.organizationId,
                      branchId: props.branchId,
                      slipId: slip.id,
                      signature,
                      receiveNote: note || undefined,
                    });
                    toast.success("Réception signée — stock POS crédité");
                    if (res.printHtml) printDoc(res.printHtml);
                    setSlip(null);
                    router.refresh();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Erreur");
                  }
                });
              }}
            >
              Signer & recevoir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
