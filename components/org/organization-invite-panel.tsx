"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { MailPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ALL_ORG_ROLE_SLUGS, ORG_ROLE } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import {
  cancelOrganizationInvitationAction,
  inviteOrganizationMemberAction,
  listOrganizationInvitationsAction,
} from "@/lib/org/invitation-actions";

type InviteRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: string;
  createdAt: string;
};

type Props = {
  organizationId: string;
};

export function OrganizationInvitePanel({ organizationId }: Props) {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>(ORG_ROLE.USER);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    try {
      const list = await listOrganizationInvitationsAction(organizationId);
      setRows(list.filter((r) => r.status === "pending"));
    } catch {
      setRows([]);
    }
  }, [organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  function sendInvite() {
    startTransition(async () => {
      try {
        await inviteOrganizationMemberAction({
          organizationId,
          email,
          role,
        });
        toast.success("Invitation créée.");
        setOpen(false);
        setEmail("");
        setRole(ORG_ROLE.USER);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Échec invitation.");
      }
    });
  }

  function cancel(id: string) {
    startTransition(async () => {
      try {
        await cancelOrganizationInvitationAction({
          organizationId,
          invitationId: id,
        });
        toast.success("Invitation annulée.");
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Échec.");
      }
    });
  }

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Invitations</h2>
          <p className="text-xs text-muted-foreground">
            Invitez un utilisateur déjà inscrit (éventuellement dans une autre
            organisation). Il ne verra que les données de cette org une fois
            active.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => setOpen(true)}
        >
          <MailPlus className="size-4" />
          Inviter
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucune invitation en attente.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{r.email}</p>
                <p className="text-xs text-muted-foreground">
                  {orgRoleLabel(r.role)} · expire{" "}
                  {new Date(r.expiresAt).toLocaleDateString("fr-FR")}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={() => cancel(r.id)}
                aria-label="Annuler l’invitation"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Inviter un utilisateur</DialogTitle>
            <DialogDescription>
              L’email doit correspondre à un compte existant. Un owner peut
              appartenir à plusieurs organisations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@exemple.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Rôle dans l’organisation</Label>
              <select
                id="invite-role"
                className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ALL_ORG_ROLE_SLUGS.filter((s) => s !== ORG_ROLE.OWNER).map(
                  (slug) => (
                    <option key={slug} value={slug}>
                      {orgRoleLabel(slug)}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={pending || !email.includes("@")}
              onClick={sendInvite}
            >
              Envoyer l’invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
