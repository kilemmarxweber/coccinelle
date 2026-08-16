"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  ArrowLeft,
  KeyRound,
  MoreHorizontal,
  Plus,
  RefreshCw,
  UserMinus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { branchDashboardPath } from "@/lib/branch/paths";
import { ORG_ROLE } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { resetOrganizationMemberPasswordAction } from "@/app/admin/organizations/[organizationId]/members/actions";
import {
  createBranchStaffAction,
  listAssignableOrgRolesAction,
  listBranchStaffAction,
  removeBranchStaffAction,
  updateBranchStaffRoleAction,
  type AssignableOrgRoleOption,
  type BranchStaffMember,
  type EquipeCapabilities,
} from "./actions";
import {
  createBranchStaffSchema,
  type CreateBranchStaffInput,
} from "./schema";
import { EquipeSectionNav } from "./equipe-section-nav";

type Props = {
  organizationId: string;
  branchId: string;
  branchName: string;
  initialStaff: BranchStaffMember[];
  initialCapabilities: EquipeCapabilities;
  initialRoles: AssignableOrgRoleOption[];
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function roleBadgeClass(role: string): string {
  if (role === ORG_ROLE.OWNER) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100";
  }
  if (role === ORG_ROLE.GERANT) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
  }
  if (role === ORG_ROLE.CAISSIER || role === ORG_ROLE.GUICHETIER) {
    return "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100";
  }
  return "border-border bg-muted text-muted-foreground";
}

export function EquipeClient({
  organizationId,
  branchId,
  branchName,
  initialStaff,
  initialCapabilities,
  initialRoles,
}: Props) {
  const router = useRouter();
  const [staff, setStaff] = useState(initialStaff);
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [roles, setRoles] = useState(initialRoles);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editMember, setEditMember] = useState<BranchStaffMember | null>(null);
  const [editRole, setEditRole] = useState("");
  const [pendingCreate, startCreate] = useTransition();
  const [pendingEdit, startEdit] = useTransition();
  const [pendingRemove, startRemove] = useTransition();
  const [pendingReset, startReset] = useTransition();
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const defaultRole =
    roles.find((r) => r.role === ORG_ROLE.CAISSIER)?.role ??
    roles.find((r) => !r.isOwner)?.role ??
    roles[0]?.role ??
    "";

  const form = useForm<CreateBranchStaffInput>({
    resolver: zodResolver(createBranchStaffSchema),
    defaultValues: {
      organizationId,
      branchId,
      email: "",
      name: "",
      phone: "",
      orgRole: defaultRole,
    },
    mode: "onSubmit",
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, rolesRes] = await Promise.all([
        listBranchStaffAction(organizationId, branchId),
        listAssignableOrgRolesAction(organizationId),
      ]);
      setCapabilities(staffRes.capabilities);
      if (staffRes.ok) {
        setStaff(staffRes.staff);
      } else {
        toast.error(staffRes.message);
        setStaff([]);
      }
      if (rolesRes.ok) {
        setRoles(rolesRes.roles);
      }
    } catch {
      toast.error("Erreur réseau lors du chargement de l’équipe.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, branchId]);

  useEffect(() => {
    if (createOpen) {
      form.reset({
        organizationId,
        branchId,
        email: "",
        name: "",
        phone: "",
        orgRole: defaultRole,
      });
    }
  }, [createOpen, organizationId, branchId, defaultRole, form]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return staff;
    return staff.filter((m) => {
      const label = orgRoleLabel(m.orgRole).toLowerCase();
      return (
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        m.orgRole.toLowerCase().includes(query) ||
        label.includes(query)
      );
    });
  }, [staff, q]);

  function onCreate(values: CreateBranchStaffInput) {
    startCreate(async () => {
      const res = await createBranchStaffAction({
        ...values,
        organizationId,
        branchId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        "Membre créé et rattaché à cet établissement. Mot de passe envoyé par email.",
      );
      setCreateOpen(false);
      router.refresh();
      await reload();
    });
  }

  function onSaveRole() {
    if (!editMember || !editRole) return;
    setBusyMemberId(editMember.memberId);
    startEdit(async () => {
      const res = await updateBranchStaffRoleAction({
        organizationId,
        branchId,
        memberId: editMember.memberId,
        orgRole: editRole,
      });
      setBusyMemberId(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Rôle mis à jour.");
      setEditMember(null);
      router.refresh();
      await reload();
    });
  }

  function onRemove(m: BranchStaffMember) {
    if (
      !window.confirm(
        `Retirer ${m.name} de « ${branchName} » ? Le compte reste dans l’organisation.`,
      )
    ) {
      return;
    }
    setBusyMemberId(m.memberId);
    startRemove(async () => {
      const res = await removeBranchStaffAction({
        organizationId,
        branchId,
        memberId: m.memberId,
      });
      setBusyMemberId(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Membre retiré de cet établissement.");
      router.refresh();
      await reload();
    });
  }

  function onResetPassword(m: BranchStaffMember) {
    if (
      !window.confirm(
        `Réinitialiser le mot de passe de ${m.name} ? Un mot de passe temporaire sera envoyé par email.`,
      )
    ) {
      return;
    }
    setBusyMemberId(m.memberId);
    startReset(async () => {
      const res = await resetOrganizationMemberPasswordAction({
        organizationId,
        memberId: m.memberId,
      });
      setBusyMemberId(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Mot de passe réinitialisé. Email envoyé (ou journalisé en dev).");
    });
  }

  if (!capabilities.canView) {
    return (
      <div className="mx-auto max-w-3xl flex flex-col gap-4 px-4 py-10 sm:px-6">
        <EquipeSectionNav
          organizationId={organizationId}
          branchId={branchId}
          active="personnel"
        />
        <div className="rounded-2xl border border-dashed border-border px-6 py-12 text-center">
          <Users className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">Accès refusé</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Permission insuffisante (Équipe · Voir).
          </p>
          <Button
            className="mt-4"
            variant="outline"
            render={
              <Link href={branchDashboardPath(organizationId, branchId)} />
            }
          >
            <ArrowLeft className="size-4" />
            Retour au hub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl flex flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <EquipeSectionNav
        organizationId={organizationId}
        branchId={branchId}
        active="personnel"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Équipe
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Personnel — {branchName}
          </h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Membres rattachés à cet établissement uniquement. La vue globale
            multi-branches reste sur{" "}
            <Link
              href={`/admin/organizations/${organizationId}/members`}
              className="underline underline-offset-2"
            >
              Membres (org)
            </Link>
            .
          </p>
          {!capabilities.canAssignOwner ? (
            <p className="max-w-xl text-xs text-muted-foreground">
              Le rôle owner n’est assignable que par un admin plateforme ou le
              propriétaire de l’organisation.
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 touch-manipulation"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Actualiser
          </Button>
          {capabilities.canManage ? (
            <Button
              className="h-11 touch-manipulation"
              type="button"
              onClick={() => setCreateOpen(true)}
              disabled={roles.filter((r) => !r.isOwner).length === 0 && !capabilities.canAssignOwner}
            >
              <Plus className="size-4" />
              Créer un membre
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Rechercher par nom, email ou rôle…"
          className="w-full sm:max-w-md"
        />
        <p className="text-xs text-muted-foreground tabular-nums sm:text-sm">
          {loading
            ? "Chargement…"
            : `${filtered.length} membre${filtered.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {loading && staff.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-[4.5rem] animate-pulse rounded-2xl border border-border bg-muted/40"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-6 py-14 text-center">
          <Users className="mx-auto size-8 text-muted-foreground/60" />
          <p className="mt-3 text-sm font-medium">
            {staff.length === 0
              ? "Aucun personnel sur cet établissement."
              : "Aucun résultat pour cette recherche."}
          </p>
          {staff.length === 0 && capabilities.canManage ? (
            <Button className="mt-4 h-11" type="button" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Créer le premier membre
            </Button>
          ) : null}
        </div>
      ) : (
        <ul
          className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          role="list"
        >
          {filtered.map((m, index) => {
            const busy = busyMemberId === m.memberId;
            return (
              <li
                key={m.branchMemberId}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5",
                  index > 0 && "border-t border-border",
                )}
              >
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials(m.name || m.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium leading-snug">
                      {m.name || "Sans nom"}
                    </p>
                    <Badge
                      variant="outline"
                      className={cn("font-medium", roleBadgeClass(m.orgRole))}
                    >
                      {orgRoleLabel(m.orgRole)}
                    </Badge>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {m.email}
                  </p>
                  {m.phone ? (
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {m.phone}
                    </p>
                  ) : null}
                </div>
                {capabilities.canManage ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
                      aria-label={`Actions pour ${m.name}`}
                      disabled={busy || pendingCreate}
                    >
                      <MoreHorizontal className="size-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-52">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditMember(m);
                          setEditRole(m.orgRole);
                        }}
                      >
                        Modifier le rôle
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={busy && pendingReset}
                        onClick={() => onResetPassword(m)}
                      >
                        <KeyRound className="size-4" />
                        Réinitialiser le mot de passe
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        disabled={busy && pendingRemove}
                        onClick={() => onRemove(m)}
                      >
                        <UserMinus className="size-4" />
                        Retirer de la branche
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Button
        variant="ghost"
        className="h-11 touch-manipulation"
        render={<Link href={branchDashboardPath(organizationId, branchId)} />}
      >
        <ArrowLeft className="size-4" />
        Retour au hub
      </Button>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau membre — {branchName}</DialogTitle>
            <DialogDescription>
              Compte créé avec un mot de passe temporaire envoyé par email, et
              rattaché automatiquement à cet établissement.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit(onCreate)}
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom complet</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="name"
                        disabled={pendingCreate}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="email"
                        autoComplete="email"
                        disabled={pendingCreate}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="tel"
                        placeholder="+243…"
                        disabled={pendingCreate}
                        className="h-11"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="orgRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rôle</FormLabel>
                    <FormControl>
                      <Select
                        {...field}
                        disabled={pendingCreate || roles.length === 0}
                        className="h-11 w-full"
                      >
                        {roles.map((r) => (
                          <option key={r.role} value={r.role}>
                            {r.label}
                            {r.isOwner ? " (système)" : ""}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pendingCreate}
                  onClick={() => setCreateOpen(false)}
                >
                  Annuler
                </Button>
                <Button type="submit" disabled={pendingCreate || roles.length === 0}>
                  {pendingCreate ? "Création…" : "Créer"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editMember)}
        onOpenChange={(open) => {
          if (!open) setEditMember(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le rôle</DialogTitle>
            <DialogDescription>
              {editMember
                ? `Met à jour le rôle d’organisation de ${editMember.name} (Member.role).`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Select
              value={editRole}
              onChange={(e) => setEditRole(e.target.value)}
              disabled={pendingEdit || roles.length === 0}
              className="h-11 w-full"
            >
              {roles.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.label}
                  {r.isOwner ? " (système)" : ""}
                </option>
              ))}
            </Select>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pendingEdit}
                onClick={() => setEditMember(null)}
              >
                Annuler
              </Button>
              <Button
                type="button"
                disabled={pendingEdit || !editRole}
                onClick={onSaveRole}
              >
                {pendingEdit ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
