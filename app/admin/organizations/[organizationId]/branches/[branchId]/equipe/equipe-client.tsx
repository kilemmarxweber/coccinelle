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
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { opsRoleLabel } from "@/lib/branch/ops-roles";
import { branchDashboardPath } from "@/lib/branch/paths";
import { ORG_ROLE } from "@/lib/permissions";
import { cn } from "@/lib/utils";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Badge } from "@/components/ui/badge";
import { choiceBtnClass, ParametresPanel } from "../parametres/parametres-section-nav";
import { resetOrganizationMemberPasswordAction } from "@/app/admin/organizations/[organizationId]/members/actions";
import { listAssignableOpsRolesAction } from "@/lib/branch/privilege-actions";
import { suggestMemberEmail } from "@/lib/slug";
import {
  createBranchStaffAction,
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
import { EquipePayrollDialog } from "./equipe-payroll-dialog";

type OpsRoleOption = { slug: string; label: string };

type Props = {
  organizationId: string;
  organizationSlug: string;
  branchId: string;
  branchName: string;
  initialStaff: BranchStaffMember[];
  initialCapabilities: EquipeCapabilities;
  initialRoles: AssignableOrgRoleOption[];
  initialOpsRoles?: OpsRoleOption[];
  isCommerce?: boolean;
  hideSectionNav?: boolean;
  embedded?: boolean;
};

const BRANCH_ORG_ROLES = [
  { role: ORG_ROLE.ADMIN, label: "Admin" },
  { role: ORG_ROLE.USER, label: "User" },
] as const;

function OrgRoleButtons({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (role: typeof ORG_ROLE.ADMIN | typeof ORG_ROLE.USER) => void;
  disabled?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {BRANCH_ORG_ROLES.map((opt) => {
        const active = value === opt.role;
        return (
          <button
            key={opt.role}
            type="button"
            disabled={disabled}
            onClick={() => onChange(opt.role)}
            className={choiceBtnClass(active)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function toBranchOrgRole(role: string): typeof ORG_ROLE.ADMIN | typeof ORG_ROLE.USER {
  return role === ORG_ROLE.ADMIN ? ORG_ROLE.ADMIN : ORG_ROLE.USER;
}

function UserActionsMenu({
  m,
  busy,
  pendingCreate,
  pendingReset,
  pendingRemove,
  isCommerce,
  onEdit,
  onPayroll,
  onReset,
  onRemove,
}: {
  m: BranchStaffMember;
  busy: boolean;
  pendingCreate: boolean;
  pendingReset: boolean;
  pendingRemove: boolean;
  isCommerce: boolean;
  onEdit: () => void;
  onPayroll: () => void;
  onReset: () => void;
  onRemove: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Actions pour ${m.name}`}
        disabled={busy || pendingCreate}
      >
        <MoreHorizontal className="size-5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onClick={onEdit}>Modifier le rôle</DropdownMenuItem>
        {isCommerce ? (
          <DropdownMenuItem onClick={onPayroll}>
            <Wallet className="size-4" />
            Paie & versement
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuItem disabled={busy && pendingReset} onClick={onReset}>
          <KeyRound className="size-4" />
          Réinitialiser le mot de passe
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={busy && pendingRemove}
          onClick={onRemove}
        >
          <UserMinus className="size-4" />
          Retirer de la branche
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function EquipeClient({
  organizationId,
  organizationSlug,
  branchId,
  branchName,
  initialStaff,
  initialCapabilities,
  initialRoles: _initialRoles,
  initialOpsRoles = [],
  isCommerce = false,
  hideSectionNav = false,
  embedded = false,
}: Props) {
  const router = useRouter();
  const [staff, setStaff] = useState(initialStaff);
  const [capabilities, setCapabilities] = useState(initialCapabilities);
  const [opsRoles, setOpsRoles] = useState(initialOpsRoles);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editMember, setEditMember] = useState<BranchStaffMember | null>(null);
  const [editRole, setEditRole] = useState<
    typeof ORG_ROLE.ADMIN | typeof ORG_ROLE.USER
  >(ORG_ROLE.USER);
  const [editOpsRole, setEditOpsRole] = useState("");
  const [pendingCreate, startCreate] = useTransition();
  const [pendingEdit, startEdit] = useTransition();
  const [pendingRemove, startRemove] = useTransition();
  const [pendingReset, startReset] = useTransition();
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [payrollMember, setPayrollMember] = useState<BranchStaffMember | null>(null);

  const defaultRole = ORG_ROLE.USER;

  const defaultOpsRole =
    opsRoles.find((r) => r.slug === "gerant")?.slug ??
    opsRoles.find((r) => r.slug === "caissier")?.slug ??
    opsRoles[0]?.slug ??
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
      opsRole: defaultOpsRole,
    },
    mode: "onSubmit",
  });

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [staffRes, opsRes] = await Promise.all([
        listBranchStaffAction(organizationId, branchId),
        listAssignableOpsRolesAction(),
      ]);
      setCapabilities(staffRes.capabilities);
      if (staffRes.ok) {
        setStaff(staffRes.staff);
      } else {
        toast.error(staffRes.message);
        setStaff([]);
      }
      setOpsRoles(
        opsRes.map((r) => ({
          slug: r.slug,
          label: r.label,
        })),
      );
    } catch {
      toast.error("Erreur réseau lors du chargement des utilisateurs.");
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
        opsRole: defaultOpsRole,
      });
    }
  }, [createOpen, organizationId, branchId, defaultRole, defaultOpsRole, form]);

  const filtered = useMemo(() => {
    const visible = staff.filter((m) => m.orgRole !== ORG_ROLE.OWNER);
    const query = q.trim().toLowerCase();
    if (!query) return visible;
    return visible.filter((m) => {
      const label = orgRoleLabel(m.orgRole).toLowerCase();
      const métier = opsRoleLabel(m.opsRole).toLowerCase();
      return (
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query) ||
        m.orgRole.toLowerCase().includes(query) ||
        m.opsRole.toLowerCase().includes(query) ||
        label.includes(query) ||
        métier.includes(query)
      );
    });
  }, [staff, q]);

  function fillEmailIfEmpty(name: string) {
    if (form.getValues("email").trim()) return;
    const generated = suggestMemberEmail(name, organizationSlug);
    if (generated) {
      form.setValue("email", generated, { shouldValidate: true });
    }
  }

  function onCreate(values: CreateBranchStaffInput) {
    fillEmailIfEmpty(values.name);
    const email = form.getValues("email").trim() || values.email;
    startCreate(async () => {
      const res = await createBranchStaffAction({
        ...values,
        email,
        organizationId,
        branchId,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(
        "Utilisateur créé. Mot de passe envoyé par email et WhatsApp (si numéro renseigné).",
      );
      setCreateOpen(false);
      router.refresh();
      await reload();
    });
  }

  function onSaveRole() {
    if (!editMember || !editRole || !editOpsRole) return;
    setBusyMemberId(editMember.memberId);
    startEdit(async () => {
      const res = await updateBranchStaffRoleAction({
        organizationId,
        branchId,
        memberId: editMember.memberId,
        orgRole: editRole,
        opsRole: editOpsRole,
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
        `Réinitialiser le mot de passe de ${m.name} ? Un mot de passe temporaire sera envoyé par email et WhatsApp (si numéro renseigné).`,
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
      toast.success(
        "Mot de passe réinitialisé. Envoyé par email et WhatsApp (si numéro renseigné).",
      );
    });
  }

  if (!capabilities.canView) {
    return (
      <div className="mx-auto max-w-3xl flex flex-col gap-4 px-4 py-10 sm:px-6">
        {hideSectionNav ? null : (
          <EquipeSectionNav
            organizationId={organizationId}
            branchId={branchId}
            active="personnel"
          />
        )}
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
    <div className="space-y-4">
      {embedded || hideSectionNav ? null : (
        <EquipeSectionNav
          organizationId={organizationId}
          branchId={branchId}
          active="personnel"
        />
      )}

      {embedded ? null : (
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Utilisateurs — {branchName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Admin ou User uniquement.
          </p>
        </div>
      )}

      <ParametresPanel
        title="Comptes de la branche"
        description={`${filtered.length} utilisateur${filtered.length === 1 ? "" : "s"}${q.trim() ? " (filtre)" : ""}.`}
        icon={Users}
        actions={
          capabilities.canManage ? (
            <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Créer
            </Button>
          ) : undefined
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Rechercher…"
            className="w-full sm:max-w-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void reload()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Actualiser
          </Button>
        </div>

        {loading && staff.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Chargement…
          </p>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {q.trim()
                ? "Aucun résultat."
                : "Aucun utilisateur sur cette branche."}
            </p>
            {!q.trim() && capabilities.canManage ? (
              <Button className="mt-3" type="button" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                Créer un utilisateur
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Nom</th>
                  <th className="py-2 pr-3 font-medium">Rôle</th>
                  <th className="hidden py-2 pr-3 font-medium sm:table-cell">
                    Métier
                  </th>
                  <th className="hidden py-2 pr-3 font-medium md:table-cell">
                    Contact
                  </th>
                  <th className="py-2 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const busy = busyMemberId === m.memberId;
                  return (
                    <tr key={m.branchMemberId} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <p className="font-medium">{m.name || "Sans nom"}</p>
                        <p className="text-xs text-muted-foreground">{m.email}</p>
                      </td>
                      <td className="py-2.5 pr-3">
                        <Badge variant="outline">
                          {orgRoleLabel(toBranchOrgRole(m.orgRole))}
                        </Badge>
                      </td>
                      <td className="hidden py-2.5 pr-3 sm:table-cell">
                        {opsRoleLabel(m.opsRole)}
                      </td>
                      <td className="hidden py-2.5 pr-3 tabular-nums text-muted-foreground md:table-cell">
                        {m.phone ?? "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        {capabilities.canManage ? (
                          <UserActionsMenu
                            m={m}
                            busy={busy}
                            pendingCreate={pendingCreate}
                            pendingReset={pendingReset}
                            pendingRemove={pendingRemove}
                            isCommerce={isCommerce}
                            onEdit={() => {
                              setEditMember(m);
                              setEditRole(toBranchOrgRole(m.orgRole));
                              setEditOpsRole(m.opsRole);
                            }}
                            onPayroll={() => setPayrollMember(m)}
                            onReset={() => onResetPassword(m)}
                            onRemove={() => onRemove(m)}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ParametresPanel>

      {embedded ? null : (
        <Button
          variant="ghost"
          size="sm"
          render={<Link href={branchDashboardPath(organizationId, branchId)} />}
        >
          <ArrowLeft className="size-4" />
          Retour au hub
        </Button>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvel utilisateur — {branchName}</DialogTitle>
            <DialogDescription>
              Compte créé avec un mot de passe temporaire envoyé par email et
              WhatsApp (si numéro renseigné), rattaché à cette branche.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              className="flex flex-col gap-4"
              onSubmit={form.handleSubmit(onCreate)}
            >
              <FormField
                control={form.control}
                name="orgRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rôle</FormLabel>
                    <FormControl>
                      <OrgRoleButtons
                        value={field.value}
                        disabled={pendingCreate}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
                        onBlur={(e) => {
                          field.onBlur();
                          fillEmailIfEmpty(e.target.value);
                        }}
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
                        placeholder="Généré à partir du nom si vide"
                        disabled={pendingCreate}
                        className="h-11"
                      />
                    </FormControl>
                    <FormDescription>
                      Obligatoire. Si vide, généré automatiquement à partir du nom (comme un slug).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone WhatsApp</FormLabel>
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
                name="opsRole"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Métier sur la branche</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Détermine le dashboard et les privilèges.
                    </p>
                    <FormControl>
                      <div className="flex flex-wrap gap-1.5">
                        {opsRoles.map((r) => {
                          const active = field.value === r.slug;
                          return (
                            <button
                              key={r.slug}
                              type="button"
                              disabled={pendingCreate}
                              onClick={() => field.onChange(r.slug)}
                              className={choiceBtnClass(active)}
                            >
                              {r.label}
                            </button>
                          );
                        })}
                      </div>
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
                <Button
                  type="submit"
                  disabled={pendingCreate || opsRoles.length === 0}
                >
                  {pendingCreate ? "Création…" : "Créer l’utilisateur"}
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
            <DialogTitle>Modifier rôles et métier</DialogTitle>
            <DialogDescription>
              {editMember
                ? `Met à jour le rôle d’organisation et le métier de ${editMember.name}.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Rôle</p>
              <OrgRoleButtons
                value={editRole}
                disabled={pendingEdit}
                onChange={setEditRole}
              />
            </div>
            <div className="grid gap-1.5">
              <p className="text-sm font-medium">Métier sur la branche</p>
              <div className="flex flex-wrap gap-1.5">
                {opsRoles.map((r) => {
                  const active = editOpsRole === r.slug;
                  return (
                    <button
                      key={r.slug}
                      type="button"
                      disabled={pendingEdit}
                      onClick={() => setEditOpsRole(r.slug)}
                      className={choiceBtnClass(active)}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </div>
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
                disabled={pendingEdit || !editRole || !editOpsRole}
                onClick={onSaveRole}
              >
                {pendingEdit ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {isCommerce ? (
        <EquipePayrollDialog
          organizationId={organizationId}
          branchId={branchId}
          branchMemberId={payrollMember?.branchMemberId ?? null}
          agentName={payrollMember?.name ?? ""}
          onClose={() => setPayrollMember(null)}
        />
      ) : null}
    </div>
  );
}
