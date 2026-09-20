"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { cancelAffiliateOrderRequestAction } from "@/lib/factory/portal-actions";

export function AffilieCancelRequestButton(props: {
  orgSlug: string;
  requestId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs font-medium text-destructive underline-offset-2 hover:underline disabled:opacity-50"
      onClick={() => {
        if (!window.confirm("Annuler cette demande en attente ?")) return;
        start(async () => {
          try {
            await cancelAffiliateOrderRequestAction({
              orgSlug: props.orgSlug,
              requestId: props.requestId,
            });
            toast.success("Demande annulée");
            router.refresh();
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Erreur");
          }
        });
      }}
    >
      {pending ? "…" : "Annuler"}
    </button>
  );
}
