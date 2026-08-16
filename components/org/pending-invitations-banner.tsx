"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mail, Check, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  acceptOrganizationInvitationAction,
  listMyPendingInvitationsAction,
} from "@/lib/org/invitation-actions";

type Invite = {
  id: string;
  role: string;
  expiresAt: string;
  organizationId: string;
  organizationName: string;
};

/** Bannière des invitations reçues (autres organisations). */
export function PendingInvitationsBanner() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void listMyPendingInvitationsAction()
      .then(setInvites)
      .catch(() => setInvites([]));
  }, []);

  if (invites.length === 0) return null;

  function accept(id: string) {
    startTransition(async () => {
      try {
        const res = await acceptOrganizationInvitationAction(id);
        toast.success("Invitation acceptée.");
        setInvites((prev) => prev.filter((i) => i.id !== id));
        if (res.organizationId) {
          router.push(`/admin/organizations/${res.organizationId}/branches`);
          router.refresh();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Échec acceptation.");
      }
    });
  }

  function dismiss(id: string) {
    setInvites((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="space-y-2">
      {invites.map((inv) => (
        <div
          key={inv.id}
          className="flex flex-col gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-2 text-sm">
            <Mail className="mt-0.5 size-4 shrink-0 text-sky-600" />
            <div>
              <p className="font-medium">
                Invitation : {inv.organizationName}
              </p>
              <p className="text-xs text-muted-foreground">
                Rôle proposé · {inv.role} — expire le{" "}
                {new Date(inv.expiresAt).toLocaleDateString("fr-FR")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => accept(inv.id)}
            >
              <Check className="size-3.5" />
              Accepter
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => dismiss(inv.id)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
