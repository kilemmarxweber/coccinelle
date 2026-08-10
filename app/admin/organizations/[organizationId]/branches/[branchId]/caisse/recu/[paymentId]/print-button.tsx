"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton(props: { autoPrint?: boolean }) {
  useEffect(() => {
    if (!props.autoPrint) return;
    const t = window.setTimeout(() => window.print(), 400);
    return () => window.clearTimeout(t);
  }, [props.autoPrint]);

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
