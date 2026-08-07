"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button
      type="button"
      className="gap-1.5"
      onClick={() => window.print()}
    >
      <Printer className="size-4" />
      Imprimer
    </Button>
  );
}
