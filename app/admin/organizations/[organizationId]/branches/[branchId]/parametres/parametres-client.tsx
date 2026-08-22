"use client";

import { useMemo, useState, useTransition } from "react";
import { KeyRound, Pencil, Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
  ParametresPanel,
  segmentedTabClass,
} from "./parametres-section-nav";
import {
  PRIVILEGE_ACTIONS,
  PRIVILEGE_RESOURCE_GROUPS,
  PRIVILEGE_RESOURCE_LABELS,
  type PrivilegeActionName,
} from "@/lib/branch/privilege-seed";
import {
  createBranchRoleAction,
  deleteBranchRoleAction,
  resetRoleToSeedAction,
  saveRolePrivilegesAction,
  updateBranchRoleAction,
} from "@/lib/branch/privilege-actions";

type RoleRow = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  sortOrder: number;
  privileges: {
    resource: string;
    action: PrivilegeActionName;
    allowed: boolean;
  }[];
};

type Props = {
  organizationId: string;
  branchId: string;
  initialRoles: RoleRow[];
};

function privilegeKey(resource: string, action: PrivilegeActionName) {
  return `${resource}:${action}`;
}

function buildAllowedSet(role: RoleRow) {
  const set = new Set<string>();
  for (const p of role.privileges) {
    if (p.allowed) set.add(privilegeKey(p.resource, p.action));
  }
  return set;
}

type RoleFormState = {
  label: string;
  description: string;
  slug: string;
  cloneFromSlug: string;
};

const emptyForm = (): RoleFormState => ({
  label: "",
  description: "",
  slug: "",
  cloneFromSlug: "",
});

export function ParametresRolesClient({
  organizationId,
  branchId,
  initialRoles,
}: Props) {
  const [roles, setRoles] = useState(initialRoles);
  const [selectedSlug, setSelectedSlug] = useState(
    initialRoles[0]?.slug ?? "gerant",
  );
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState<RoleFormState>(emptyForm);
  const [mainTab, setMainTab] = useState<"roles" | "privileges">("roles");

  const selected = useMemo(
    () => roles.find((r) => r.slug === selectedSlug) ?? roles[0],
    [roles, selectedSlug],
  );

  const allowed = useMemo(
    () => (selected ? buildAllowedSet(selected) : new Set<string>()),
    [selected],
  );

  function openCreate() {
    setEditingSlug(null);
    setForm({
      ...emptyForm(),
      cloneFromSlug: selected?.slug ?? "gerant",
    });
    setDialogOpen(true);
  }

  function openEdit(role: RoleRow) {
    setEditingSlug(role.slug);
    setForm({
      label: role.label,
      description: role.description ?? "",
      slug: role.slug,
      cloneFromSlug: "",
    });
    setDialogOpen(true);
  }

  function toggle(resource: string, action: PrivilegeActionName) {
    if (!selected) return;
    const key = privilegeKey(resource, action);
    const nextAllowed = !allowed.has(key);
    setRoles((prev) =>
      prev.map((role) => {
        if (role.slug !== selected.slug) return role;
        const others = role.privileges.filter(
          (p) => !(p.resource === resource && p.action === action),
        );
        return {
          ...role,
          privileges: nextAllowed
            ? [...others, { resource, action, allowed: true }]
            : others,
        };
      }),
    );
  }

  function savePrivileges() {
    if (!selected) return;
    startTransition(async () => {
      try {
        const matrix: {
          resource: string;
          action: PrivilegeActionName;
          allowed: boolean;
        }[] = [];
        for (const group of PRIVILEGE_RESOURCE_GROUPS) {
          for (const resource of group.resources) {
            for (const action of PRIVILEGE_ACTIONS) {
              matrix.push({
                resource,
                action,
                allowed: allowed.has(privilegeKey(resource, action)),
              });
            }
          }
        }
        await saveRolePrivilegesAction({
          organizationId,
          branchId,
          slug: selected.slug,
          privileges: matrix,
        });
        toast.success("Privilèges enregistrés.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Échec enregistrement.");
      }
    });
  }

  function resetPrivileges() {
    if (!selected) return;
    if (
      !confirm(
        `Réinitialiser « ${selected.label} » aux droits seed Coccinelle ?`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        await resetRoleToSeedAction({
          organizationId,
          branchId,
          slug: selected.slug,
        });
        toast.success("Rôle réinitialisé.");
        window.location.reload();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Échec reset.");
      }
    });
  }

  function submitRoleForm() {
    startTransition(async () => {
      try {
        if (editingSlug) {
          await updateBranchRoleAction({
            organizationId,
            branchId,
            slug: editingSlug,
            label: form.label,
            description: form.description,
          });
          setRoles((prev) =>
            prev.map((r) =>
              r.slug === editingSlug
                ? {
                    ...r,
                    label: form.label.trim(),
                    description: form.description.trim() || null,
                  }
                : r,
            ),
          );
          toast.success("Rôle mis à jour.");
        } else {
          const created = await createBranchRoleAction({
            organizationId,
            branchId,
            label: form.label,
            description: form.description,
            slug: form.slug || undefined,
            cloneFromSlug: form.cloneFromSlug || undefined,
          });
          toast.success("Rôle créé.");
          setDialogOpen(false);
          window.location.reload();
          void created;
          return;
        }
        setDialogOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Échec.");
      }
    });
  }

  function removeRole(role: RoleRow) {
    if (role.isSystem) {
      toast.error("Rôle système non supprimable.");
      return;
    }
    if (!confirm(`Supprimer le rôle « ${role.label} » ?`)) return;
    startTransition(async () => {
      try {
        await deleteBranchRoleAction({
          organizationId,
          branchId,
          slug: role.slug,
        });
        setRoles((prev) => prev.filter((r) => r.slug !== role.slug));
        if (selectedSlug === role.slug) {
          setSelectedSlug(
            roles.find((r) => r.slug !== role.slug)?.slug ?? "gerant",
          );
        }
        toast.success("Rôle supprimé.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Échec suppression.");
      }
    });
  }

  const tabSwitch = (
    <div className="flex gap-1 rounded-xl bg-muted p-1">
      {(
        [
          ["roles", "Rôles"],
          ["privileges", "Privilèges"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          onClick={() => setMainTab(id)}
          className={segmentedTabClass(mainTab === id)}
        >
          {label}
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {mainTab === "roles" ? (
        <ParametresPanel
          title="Métiers de la branche"
          description="Créez, renommez ou supprimez les rôles."
          icon={Shield}
          actions={
            <Button type="button" size="sm" disabled={pending} onClick={openCreate}>
              <Plus className="size-4" />
              Nouveau
            </Button>
          }
        >
          <div className="mb-4">{tabSwitch}</div>
          {roles.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aucun rôle en base.
            </p>
          ) : (
            <div className="-mx-1 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Nom</th>
                    <th className="hidden py-2 pr-3 font-medium sm:table-cell">
                      Slug
                    </th>
                    <th className="hidden py-2 pr-3 font-medium md:table-cell">
                      Description
                    </th>
                    <th className="py-2 pr-3 font-medium">Type</th>
                    <th className="py-2 text-right font-medium"> </th>
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 font-medium">{role.label}</td>
                      <td className="hidden py-2.5 pr-3 font-mono text-xs text-muted-foreground sm:table-cell">
                        {role.slug}
                      </td>
                      <td className="hidden max-w-xs truncate py-2.5 pr-3 text-muted-foreground md:table-cell">
                        {role.description ?? "—"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant={role.isSystem ? "secondary" : "outline"}>
                          {role.isSystem ? "Système" : "Perso"}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending}
                          onClick={() => openEdit(role)}
                          aria-label={`Modifier ${role.label}`}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={pending || role.isSystem}
                          onClick={() => removeRole(role)}
                          aria-label={`Supprimer ${role.label}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ParametresPanel>
      ) : !selected ? (
        <ParametresPanel
          title="Privilèges"
          description="Aucun rôle en base."
          icon={KeyRound}
          actions={tabSwitch}
        >
          <p className="py-8 text-center text-sm text-muted-foreground">
            Créez d’abord un rôle.
          </p>
        </ParametresPanel>
      ) : (
        <ParametresPanel
          title={`Privilèges — ${selected.label}`}
          description={selected.description ?? selected.slug}
          icon={KeyRound}
          actions={
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={savePrivileges}
              >
                Enregistrer
              </Button>
              {selected.isSystem ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={resetPrivileges}
                >
                  Réinitialiser
                </Button>
              ) : null}
            </div>
          }
        >
          <div className="mb-4 space-y-3">
            {tabSwitch}
            <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1">
              {roles.map((role) => (
                <button
                  key={role.slug}
                  type="button"
                  onClick={() => setSelectedSlug(role.slug)}
                  className={segmentedTabClass(role.slug === selected.slug)}
                >
                  {role.label}
                </button>
              ))}
            </div>
          </div>
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Module</th>
                  {PRIVILEGE_ACTIONS.map((a) => (
                    <th key={a} className="px-1 py-2 text-center font-medium">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PRIVILEGE_RESOURCE_GROUPS.flatMap((group) => [
                  <tr key={group.title} className="border-b bg-muted/40">
                    <td
                      colSpan={1 + PRIVILEGE_ACTIONS.length}
                      className="px-1 py-1.5 text-[11px] font-medium tracking-wide text-muted-foreground uppercase"
                    >
                      {group.title}
                    </td>
                  </tr>,
                  ...group.resources.map((resource) => (
                    <tr key={resource} className="border-b last:border-0">
                      <td className="py-1.5 pr-3">
                        {PRIVILEGE_RESOURCE_LABELS[resource] ?? resource}
                      </td>
                      {PRIVILEGE_ACTIONS.map((action) => {
                        const on = allowed.has(privilegeKey(resource, action));
                        return (
                          <td key={action} className="px-1 py-1.5 text-center">
                            <input
                              type="checkbox"
                              className="size-4 accent-primary"
                              checked={on}
                              disabled={pending}
                              onChange={() => toggle(resource, action)}
                              aria-label={`${resource} ${action}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </ParametresPanel>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSlug ? "Modifier le rôle" : "Nouveau rôle"}
            </DialogTitle>
            <DialogDescription>
              {editingSlug
                ? "Le slug reste fixe. Les privilèges se gèrent dans l’onglet Privilèges."
                : "Le slug est généré depuis le nom si vous le laissez vide."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-label">Nom</Label>
              <Input
                id="role-label"
                value={form.label}
                onChange={(e) =>
                  setForm((f) => ({ ...f, label: e.target.value }))
                }
                placeholder="Ex. Caissier nuit"
              />
            </div>
            {!editingSlug ? (
              <div className="space-y-1.5">
                <Label htmlFor="role-slug">Slug (optionnel)</Label>
                <Input
                  id="role-slug"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, slug: e.target.value }))
                  }
                  placeholder="caissier_nuit"
                  className="font-mono text-sm"
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="role-desc">Description</Label>
              <Input
                id="role-desc"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Courte description du métier"
              />
            </div>
            {!editingSlug ? (
              <div className="space-y-1.5">
                <Label htmlFor="role-clone">Cloner les privilèges de</Label>
                <select
                  id="role-clone"
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2.5 text-sm"
                  value={form.cloneFromSlug}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, cloneFromSlug: e.target.value }))
                  }
                >
                  <option value="">Aucun (vide)</option>
                  {roles.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              disabled={pending || form.label.trim().length < 2}
              onClick={submitRoleForm}
            >
              {editingSlug ? "Enregistrer" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
