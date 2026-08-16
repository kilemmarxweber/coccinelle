"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Paramètres</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez les rôles métier, puis leurs privilèges module par module.
        </p>
      </div>

      <Tabs defaultValue="roles" className="w-full">
        <TabsList className="h-11 w-full max-w-md p-1">
          <TabsTrigger value="roles" className="flex-1 h-9">
            Rôles
          </TabsTrigger>
          <TabsTrigger value="privileges" className="flex-1 h-9">
            Privilèges
          </TabsTrigger>
        </TabsList>

        <TabsContent value="roles" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Créer, modifier ou supprimer les métiers de la branche.
            </p>
            <Button type="button" disabled={pending} onClick={openCreate}>
              <Plus className="size-4" />
              Nouveau rôle
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Nom</th>
                  <th className="hidden px-4 py-3 font-medium sm:table-cell">
                    Slug
                  </th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">
                    Description
                  </th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{role.label}</td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground sm:table-cell">
                      {role.slug}
                    </td>
                    <td className="hidden max-w-xs truncate px-4 py-3 text-muted-foreground md:table-cell">
                      {role.description ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[11px] font-medium",
                          role.isSystem
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-300"
                            : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {role.isSystem ? "Système" : "Personnalisé"}
                      </span>
                      {role.slug === "caissier" ? (
                        <span className="ml-1 text-[11px] text-amber-600">
                          Legacy
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
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
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="privileges" className="mt-4">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Aucun rôle en base.</p>
          ) : (
            <div className="flex flex-col gap-4 lg:flex-row">
              <aside className="flex shrink-0 flex-row gap-2 overflow-x-auto lg:w-56 lg:flex-col">
                {roles.map((role) => (
                  <button
                    key={role.slug}
                    type="button"
                    onClick={() => setSelectedSlug(role.slug)}
                    className={cn(
                      "rounded-xl border px-3 py-2 text-left text-sm transition",
                      role.slug === selected.slug
                        ? "border-primary bg-primary/10 font-medium"
                        : "border-border bg-card/40 hover:bg-muted/40",
                    )}
                  >
                    <span className="block">{role.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {role.slug}
                    </span>
                  </button>
                ))}
              </aside>

              <div className="min-w-0 flex-1 space-y-4">
                <div className="rounded-2xl border border-border bg-card/50 px-4 py-3">
                  <p className="font-medium">{selected.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {selected.description ?? selected.slug}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      disabled={pending}
                      onClick={savePrivileges}
                    >
                      Enregistrer
                    </Button>
                    {selected.isSystem ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={resetPrivileges}
                      >
                        Réinitialiser au seed
                      </Button>
                    ) : null}
                  </div>
                </div>

                {PRIVILEGE_RESOURCE_GROUPS.map((group) => (
                  <div
                    key={group.title}
                    className="overflow-x-auto rounded-2xl border border-border"
                  >
                    <div className="border-b bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {group.title}
                    </div>
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Module</th>
                          {PRIVILEGE_ACTIONS.map((a) => (
                            <th
                              key={a}
                              className="px-2 py-2 text-center font-medium"
                            >
                              {a}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.resources.map((resource) => (
                          <tr
                            key={resource}
                            className="border-b last:border-0"
                          >
                            <td className="px-3 py-2">
                              {PRIVILEGE_RESOURCE_LABELS[resource] ?? resource}
                            </td>
                            {PRIVILEGE_ACTIONS.map((action) => {
                              const on = allowed.has(
                                privilegeKey(resource, action),
                              );
                              return (
                                <td
                                  key={action}
                                  className="px-2 py-2 text-center"
                                >
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
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

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
