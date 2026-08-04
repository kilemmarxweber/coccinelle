"use client";

import * as React from "react";
import { Download, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TicketReservation } from "@/lib/reservation/ticket-data";
import {
  downloadTicketHtml,
  openTicketPrintPreview,
} from "./ticket-print-document";
import { TicketPrintView } from "./ticket-print-view";

type Props = {
  ticket: TicketReservation;
};

export function TicketPrintActions({ ticket }: Props) {
  const [open, setOpen] = React.useState(false);

  function handlePrint() {
    const ok = openTicketPrintPreview(ticket);
    if (!ok) {
      toast.error("Autorisez les fenêtres pop-up pour imprimer le billet.");
      return;
    }
  }

  function handleDownload() {
    downloadTicketHtml(ticket);
    toast.success("Billet téléchargé (HTML imprimable).");
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          className="h-11 w-full"
          onClick={() => setOpen(true)}
        >
          <Printer data-icon="inline-start" />
          Imprimer
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 w-full"
          onClick={handleDownload}
        >
          <Download data-icon="inline-start" />
          Télécharger
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl p-0 sm:max-w-2xl">
          <DialogHeader className="border-b px-4 pt-4 pb-3 sm:px-6">
            <DialogTitle>Aperçu du billet</DialogTitle>
            <DialogDescription>
              Vérifiez les codes et QR, puis imprimez ou téléchargez. La
              réimpression ne recrée pas la réservation.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60svh] overflow-y-auto bg-neutral-100 p-3 sm:p-4">
            <TicketPrintView
              ticket={ticket}
              className="mx-auto max-w-xl shadow-sm"
            />
          </div>
          <DialogFooter className="border-t px-4 py-3 sm:px-6">
            <Button type="button" variant="outline" onClick={handleDownload}>
              <Download data-icon="inline-start" />
              Télécharger
            </Button>
            <Button type="button" onClick={handlePrint}>
              <Printer data-icon="inline-start" />
              Imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
