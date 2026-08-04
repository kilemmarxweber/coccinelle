"use client";

import { useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { createCheckoutDraftAction } from "@/lib/reservation/checkout-actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type StartCheckoutButtonProps = {
  orgSlug: string;
  departId: string;
  disabled?: boolean;
};

export function StartCheckoutButton({
  orgSlug,
  departId,
  disabled = false,
}: StartCheckoutButtonProps) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      className="h-11 w-full"
      size="lg"
      disabled={disabled || pending}
      data-testid="start-checkout"
      aria-label={
        disabled
          ? "Départ complet — réservation impossible"
          : "Continuer vers la réservation"
      }
      onClick={() => {
        startTransition(async () => {
          try {
            const result = await createCheckoutDraftAction({
              orgSlug,
              departId,
            });
            if (result && !result.ok) {
              toast.error(result.error);
            }
          } catch (e) {
            // redirect() throws ; ignore Next redirect errors
            const digest =
              e && typeof e === "object" && "digest" in e
                ? String((e as { digest?: string }).digest)
                : "";
            if (digest.startsWith("NEXT_REDIRECT")) return;
            const message =
              e instanceof Error ? e.message : "Impossible de démarrer le checkout.";
            toast.error(message);
          }
        });
      }}
    >
      {pending ? <Spinner data-icon="inline-start" /> : null}
      Continuer
      {!disabled && !pending ? (
        <ArrowRight data-icon="inline-end" aria-hidden />
      ) : null}
    </Button>
  );
}
