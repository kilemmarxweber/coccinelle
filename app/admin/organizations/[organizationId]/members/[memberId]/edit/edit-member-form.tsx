"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { ALL_ORG_ROLE_SLUGS, ORG_ROLE } from "@/lib/permissions";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  listOrganizationMemberBranchesAction,
  removeOrganizationMemberAction,
  resetOrganizationMemberPasswordAction,
  updateOrganizationMemberAction,
} from "../../actions";
import { BranchPicker, type MemberBranchOption } from "../../branch-picker";

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  user: { id: string; email: string; name: string };
};

type Props = {
  organizationId: string;
  memberId: string;
  branches: MemberBranchOption[];
};

export function EditMemberForm({ organizationId, memberId, branches }: Props) {
  const router = useRouter();
  const [member, setMember] = useState<MemberRow | null | undefined>(undefined);
  const [role, setRole] = useState<string>(ORG_ROLE.PARENT);
  const [branchIds, setBranchIds] = useState<string[]>([]);
  const [branchError, setBranchError] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();
  const [pendingRemove, startRemove] = useTransition();
  const [pendingReset, startReset] = useTransition();

  const load = useCallback(async () => {
    try {
      const [res, branchesRes] = await Promise.all([
        authClient.organization.listMembers({
          query: { organizationId, limit: 200 },
        }),
        listOrganizationMemberBranchesAction(organizationId),
      ]);
      if (res.error) {
        toast.error(res.error.message ?? "Impossible de charger le membre.");
        setMember(null);
        return;
      }
      const raw = res.data?.members;
      const list = Array.isArray(raw) ? (raw as MemberRow[]) : [];
      const found = list.find((m) => m.id === memberId) ?? null;
      setMember(found);
      if (found) {
        const primary = found.role.split(",")[0]?.trim() ?? ORG_ROLE.PARENT;
        setRole(
          (ALL_ORG_ROLE_SLUGS as readonly string[]).includes(primary) ? primary : ORG_ROLE.PARENT,
        );
        if (branchesRes.ok) {
          const assigned = branchesRes.byMemberId[found.id] ?? [];
          setBranchIds(assigned.map((b) => b.id));
        }
      }
    } catch {
      toast.error("Erreur réseau.");
      setMember(null);
    }
  }, [organizationId, memberId]);

  useEffect(() => {
    void load();
  }, [load]);

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (branchIds.length === 0) {
      setBranchError("Sélectionnez au moins une branche.");
      return;
    }
    setBranchError(undefined);
    startTransition(async () => {
      const res = await updateOrganizationMemberAction({
        organizationId,
        memberId,
        orgRole: role,
        branchIds,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Membre mis à jour.");
      router.refresh();
      await load();
    });
  }

  function onRemove() {
    if (!member) return;
    if (!window.confirm(`Retirer ${member.user.name} de l’organisation ?`)) return;
    startRemove(async () => {
      const res = await removeOrganizationMemberAction({
        organizationId,
        memberId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Membre retiré.");
      router.push(`/admin/organizations/${organizationId}/members`);
      router.refresh();
    });
  }

  function onResetPassword() {
    if (!member) return;
    if (
      !window.confirm(
        `Réinitialiser le mot de passe de ${member.user.name} ? Un mot de passe temporaire sera envoyé par email.`,
      )
    ) {
      return;
    }
    startReset(async () => {
      const res = await resetOrganizationMemberPasswordAction({
        organizationId,
        memberId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Mot de passe réinitialisé. Email envoyé (ou journalisé en dev).");
    });
  }

  if (member === undefined) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  if (member === null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">Membre introuvable.</p>
        <Button variant="outline" render={<Link href={`/admin/organizations/${organizationId}/members`} />}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  const busy = pending || pendingRemove || pendingReset;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card/50 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium leading-snug break-words">{member.user.name}</p>
          <Badge variant="secondary">{orgRoleLabel(role)}</Badge>
        </div>
        <p className="mt-1 break-all text-sm text-muted-foreground">{member.user.email}</p>
      </div>

      <form className="flex flex-col gap-4" onSubmit={onSave}>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-role">Rôle dans l’organisation</Label>
          <Select
            id="edit-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={busy}
            className="h-12 min-h-[48px] text-base touch-manipulation sm:h-11 sm:min-h-0 sm:text-sm"
          >
            {[...ALL_ORG_ROLE_SLUGS].map((slug) => (
              <option key={slug} value={slug}>
                {orgRoleLabel(slug)}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Branche(s)</Label>
          <p className="text-xs text-muted-foreground">
            Où ce membre est affecté. La première cochée devient la branche principale.
          </p>
          <BranchPicker
            branches={branches}
            value={branchIds}
            onChange={(ids) => {
              setBranchIds(ids);
              if (ids.length > 0) setBranchError(undefined);
            }}
            disabled={busy}
            error={branchError}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            type="submit"
            disabled={busy || branches.length === 0}
            className="h-12 min-h-[48px] touch-manipulation sm:h-11 sm:min-h-0"
          >
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 min-h-[48px] touch-manipulation sm:h-11 sm:min-h-0"
            disabled={busy}
            render={<Link href={`/admin/organizations/${organizationId}/members`} />}
          >
            Annuler
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="outline"
          className="h-12 min-h-[48px] touch-manipulation sm:h-11 sm:min-h-0"
          disabled={busy}
          onClick={onResetPassword}
        >
          <KeyRound className="size-4" />
          {pendingReset ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="h-12 min-h-[48px] w-full touch-manipulation sm:h-11 sm:min-h-0 sm:w-auto"
          disabled={busy}
          onClick={onRemove}
        >
          {pendingRemove ? "…" : "Retirer de l’organisation"}
        </Button>
      </div>
    </div>
  );
}
