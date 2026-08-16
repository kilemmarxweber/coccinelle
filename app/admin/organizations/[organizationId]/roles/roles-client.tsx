"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import {
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  ORG_ROLE_PRESET_LABEL_FR,
  ORG_ROLE_PRESET_PERMISSIONS,
  ORG_ROLE_PRESET_SLUGS,
  type OrgRolePresetSlug,
} from "@/lib/org/role-presets";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { branchDashboardPath } from "@/lib/branch/paths";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Field,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { EquipeSectionNav } from "@/app/admin/organizations/[organizationId]/branches/[branchId]/equipe/equipe-section-nav";
import {
  createOrgRoleAction,
  deleteOrgRoleAction,
  duplicateOrgRoleAction,
  listOrgRolesAction,
  updateOrgRoleAction,
  type AcCapabilities,
  type OrgRoleListItem,
} from "./actions";
import {
  RolePermissionMatrix,
  countPermissions,
  type PermissionMap,
} from "./role-permission-matrix";

function slugifyInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function permissionFromPreset(preset: string): PermissionMap {
  if (!preset) return {};
  if (!(preset in ORG_ROLE_PRESET_PERMISSIONS)) return {};
  const src = ORG_ROLE_PRESET_PERMISSIONS[preset as OrgRolePresetSlug];
  const out: PermissionMap = {};
  for (const [resource, actions] of Object.entries(src)) {
    out[resource] = [...actions];
  }
  return out;
}

type RolesClientProps = {
  organizationId: string;
  initialRoles: OrgRoleListItem[];
  initialCapabilities: AcCapabilities;
  /** R05 — même CRUD org depuis le hub branche (rôles partagés à toute l’org). */
  branchContext?: {
    branchId: string;
    branchName: string;
  };
};

export function RolesClient({
  organizationId,
  initialRoles,
  initialCapabilities,
  branchContext,
}: RolesClientProps) {
  const [roles, setRoles] = useState(initialRoles);
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const [createSlug, setCreateSlug] = useState("");
  const [createPreset, setCreatePreset] = useState("");
  const [createPerms, setCreatePerms] = useState<PermissionMap>({});

  const [editRole, setEditRole] = useState<OrgRoleListItem | null>(null);
  const [editSlug, setEditSlug] = useState("");
  const [editPerms, setEditPerms] = useState<PermissionMap>({});

  const [dupSource, setDupSource] = useState<OrgRoleListItem | null>(null);
  const [dupSlug, setDupSlug] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<OrgRoleListItem | null>(null);

  const orgRolesHref = `/admin/organizations/${organizationId}/roles`;
  const backHref = branchContext
    ? branchDashboardPath(organizationId, branchContext.branchId)
    : `/admin/organizations/${organizationId}`;
  const backLabel = branchContext ? "← Retour au hub" : "← Accueil organisation";

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listOrgRolesAction(organizationId);
      setCapabilities(res.capabilities);
      if (!res.ok) {
        toast.error(res.message);
        setRoles([]);
        return;
      }
      setRoles(res.roles);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    setRoles(initialRoles);
    setCapabilities(initialCapabilities);
  }, [initialRoles, initialCapabilities]);

  function openCreate() {
    setCreateSlug("");
    setCreatePreset("");
    setCreatePerms({});
    setCreateOpen(true);
  }

  function openEdit(role: OrgRoleListItem) {
    if (role.isSystem) return;
    setEditRole(role);
    setEditSlug(role.role);
    setEditPerms({ ...role.permission });
    setEditOpen(true);
  }

  function openDuplicate(role: OrgRoleListItem) {
    if (!role.id) return;
    setDupSource(role);
    setDupSlug(slugifyInput(`${role.role}-copie`));
    setDupOpen(true);
  }

  function openDelete(role: OrgRoleListItem) {
    if (role.isSystem || !role.id) return;
    setDeleteTarget(role);
    setDeleteOpen(true);
  }

  function onPresetChange(preset: string) {
    setCreatePreset(preset);
    setCreatePerms(permissionFromPreset(preset));
  }

  function submitCreate() {
    const role = slugifyInput(createSlug);
    if (!role) {
      toast.error("Indiquez un slug de rôle.");
      return;
    }
    startTransition(async () => {
      const res = await createOrgRoleAction({
        organizationId,
        role,
        permission: createPerms,
        preset: createPreset || undefined,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Rôle créé.");
      setCreateOpen(false);
      await reload();
    });
  }

  function submitEdit() {
    if (!editRole?.id) return;
    const roleName = slugifyInput(editSlug);
    if (!roleName) {
      toast.error("Indiquez un slug de rôle.");
      return;
    }
    startTransition(async () => {
      const res = await updateOrgRoleAction({
        organizationId,
        roleId: editRole.id!,
        roleName,
        permission: editPerms,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Rôle enregistré.");
      setEditOpen(false);
      await reload();
    });
  }

  function submitDuplicate() {
    if (!dupSource?.id) return;
    const role = slugifyInput(dupSlug);
    if (!role) {
      toast.error("Indiquez un slug de rôle.");
      return;
    }
    startTransition(async () => {
      const res = await duplicateOrgRoleAction({
        organizationId,
        sourceRoleId: dupSource.id!,
        role,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Rôle dupliqué.");
      setDupOpen(false);
      await reload();
    });
  }

  function submitDelete() {
    if (!deleteTarget?.id) return;
    startTransition(async () => {
      const res = await deleteOrgRoleAction({
        organizationId,
        roleId: deleteTarget.id!,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Rôle supprimé.");
      setDeleteOpen(false);
      await reload();
    });
  }

  if (!capabilities.canRead) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
        <p className="text-sm text-muted-foreground">
          Accès refusé — permission requise : Contrôle d’accès · Voir.
        </p>
        {branchContext ? (
          <EquipeSectionNav
            organizationId={organizationId}
            branchId={branchContext.branchId}
            active="roles"
          />
        ) : null}
        <Button variant="ghost" render={<Link href={backHref} />}>
          {backLabel}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-3xl flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-8 md:px-6">
      {branchContext ? (
        <EquipeSectionNav
          organizationId={organizationId}
          branchId={branchContext.branchId}
          active="roles"
        />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <Shield className="size-5 text-muted-foreground" aria-hidden />
            {branchContext
              ? `Rôles — ${branchContext.branchName}`
              : "Rôles de l’organisation"}
          </h1>
          <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
            {branchContext ? (
              <>
                Les rôles sont stockés au niveau organisation (partagés à tous
                les établissements). Owner reste un rôle système verrouillé.
                Vue complète :{" "}
                <Link
                  href={orgRolesHref}
                  className="underline underline-offset-2"
                >
                  Rôles (org)
                </Link>
                .
              </>
            ) : (
              <>
                Owner est un rôle système verrouillé. Les autres rôles sont
                custom (DAC) — créez, éditez ou dupliquez la matrice de
                permissions (libellés FR).
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || pending}
            onClick={() => void reload()}
          >
            {loading ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RefreshCw data-icon="inline-start" />
            )}
            Actualiser
          </Button>
          {capabilities.canCreate ? (
            <Button type="button" size="sm" onClick={openCreate}>
              <Plus data-icon="inline-start" />
              Créer un rôle
            </Button>
          ) : null}
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        {roles.map((item) => {
          const n = countPermissions(item.permission);
          return (
            <li
              key={item.id ?? item.role}
              className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{orgRoleLabel(item.role)}</span>
                  {item.isSystem ? (
                    <Badge variant="secondary">Système</Badge>
                  ) : null}
                  <Badge variant="outline" className="font-normal">
                    {n} permission{n === 1 ? "" : "s"}
                  </Badge>
                  {item.memberCount > 0 ? (
                    <Badge variant="outline" className="font-normal">
                      {item.memberCount} membre{item.memberCount === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                </div>
                <p className="break-all font-mono text-xs text-muted-foreground">
                  slug · {item.role}
                </p>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {!item.isSystem && (capabilities.canUpdate || capabilities.canCreate || capabilities.canDelete) ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
                      aria-label={`Actions pour ${item.role}`}
                      disabled={pending}
                    >
                      <MoreHorizontal className="size-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      {capabilities.canUpdate ? (
                        <DropdownMenuItem onClick={() => openEdit(item)}>
                          <Pencil className="size-4" />
                          Modifier
                        </DropdownMenuItem>
                      ) : null}
                      {capabilities.canCreate && item.id ? (
                        <DropdownMenuItem onClick={() => openDuplicate(item)}>
                          <Copy className="size-4" />
                          Dupliquer
                        </DropdownMenuItem>
                      ) : null}
                      {capabilities.canDelete && item.id ? (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => openDelete(item)}
                          >
                            <Trash2 className="size-4" />
                            Supprimer
                          </DropdownMenuItem>
                        </>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : item.isSystem ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditRole(item);
                      setEditSlug(item.role);
                      setEditPerms({ ...item.permission });
                      setEditOpen(true);
                    }}
                  >
                    Voir la matrice
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <Button
        variant="ghost"
        className="h-11 min-h-[44px] w-full touch-manipulation sm:w-fit sm:px-3"
        render={<Link href={backHref} />}
      >
        {backLabel}
      </Button>

      {/* Créer */}
      <ResponsiveDialog open={createOpen} onOpenChange={setCreateOpen}>
        <ResponsiveDialogContent className="sm:max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Créer un rôle</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Choisissez un slug, un preset optionnel, puis cochez les
              permissions (Ressource · Action).
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <FieldGroup className="gap-4 py-2">
            <Field>
              <FieldLabel htmlFor="create-slug">Slug du rôle</FieldLabel>
              <Input
                id="create-slug"
                value={createSlug}
                placeholder="ex. test"
                autoComplete="off"
                onChange={(e) => setCreateSlug(e.target.value)}
                onBlur={() => setCreateSlug((s) => slugifyInput(s))}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="create-preset">Partir de</FieldLabel>
              <Select
                id="create-preset"
                value={createPreset}
                onChange={(e) => onPresetChange(e.target.value)}
              >
                <option value="">Vide (aucune permission)</option>
                {ORG_ROLE_PRESET_SLUGS.map((slug) => (
                  <option key={slug} value={slug}>
                    {ORG_ROLE_PRESET_LABEL_FR[slug]}
                  </option>
                ))}
              </Select>
            </Field>
            <RolePermissionMatrix value={createPerms} onChange={setCreatePerms} />
          </FieldGroup>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setCreateOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" disabled={pending} onClick={submitCreate}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Créer
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Éditer / voir owner */}
      <ResponsiveDialog open={editOpen} onOpenChange={setEditOpen}>
        <ResponsiveDialogContent className="sm:max-w-2xl">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>
              {editRole?.isSystem
                ? "Owner (système)"
                : `Modifier · ${editRole ? orgRoleLabel(editRole.role) : ""}`}
            </ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {editRole?.isSystem
                ? "Rôle système verrouillé — pas de rename, pas d’édition de matrice, pas de suppression."
                : "Modifiez le slug et la matrice, puis enregistrez."}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <FieldGroup className="gap-4 py-2">
            <Field>
              <FieldLabel htmlFor="edit-slug">Slug du rôle</FieldLabel>
              <Input
                id="edit-slug"
                value={editSlug}
                disabled={editRole?.isSystem || !capabilities.canUpdate}
                autoComplete="off"
                onChange={(e) => setEditSlug(e.target.value)}
                onBlur={() => setEditSlug((s) => slugifyInput(s))}
              />
            </Field>
            <RolePermissionMatrix
              value={editPerms}
              onChange={setEditPerms}
              readOnly={
                Boolean(editRole?.isSystem) || !capabilities.canUpdate
              }
            />
          </FieldGroup>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setEditOpen(false)}
            >
              Fermer
            </Button>
            {!editRole?.isSystem && capabilities.canUpdate ? (
              <Button type="button" disabled={pending} onClick={submitEdit}>
                {pending ? <Spinner data-icon="inline-start" /> : null}
                Enregistrer
              </Button>
            ) : null}
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Dupliquer */}
      <ResponsiveDialog open={dupOpen} onOpenChange={setDupOpen}>
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Dupliquer le rôle</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              Nouvelle copie de « {dupSource ? orgRoleLabel(dupSource.role) : ""} » avec
              les mêmes permissions.
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <FieldGroup className="gap-4 py-2">
            <Field>
              <FieldLabel htmlFor="dup-slug">Nouveau slug</FieldLabel>
              <Input
                id="dup-slug"
                value={dupSlug}
                autoComplete="off"
                onChange={(e) => setDupSlug(e.target.value)}
                onBlur={() => setDupSlug((s) => slugifyInput(s))}
              />
            </Field>
          </FieldGroup>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDupOpen(false)}
            >
              Annuler
            </Button>
            <Button type="button" disabled={pending} onClick={submitDuplicate}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Dupliquer
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>

      {/* Supprimer */}
      <ResponsiveDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <ResponsiveDialogContent className="sm:max-w-md">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle>Supprimer le rôle ?</ResponsiveDialogTitle>
            <ResponsiveDialogDescription>
              {deleteTarget && deleteTarget.memberCount > 0
                ? `« ${orgRoleLabel(deleteTarget.role)} » est encore assigné à ${deleteTarget.memberCount} membre(s). Réassignez-les avant de supprimer.`
                : `Supprimer définitivement « ${deleteTarget ? orgRoleLabel(deleteTarget.role) : ""} ». Cette action est irréversible.`}
            </ResponsiveDialogDescription>
          </ResponsiveDialogHeader>
          <ResponsiveDialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => setDeleteOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                pending ||
                Boolean(deleteTarget && deleteTarget.memberCount > 0)
              }
              onClick={submitDelete}
            >
              {pending ? <Spinner data-icon="inline-start" /> : null}
              Supprimer
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </div>
  );
}
