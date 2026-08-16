"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { orgRoleLabel } from "@/lib/org-role-labels";
import { ORG_ROLE } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchInput } from "@/components/ui/search-input";
import {
  listOrganizationMemberBranchesAction,
  resetOrganizationMemberPasswordAction,
  type MemberBranchSummary,
} from "./actions";

const PAGE_SIZE = 8;

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  createdAt: Date | string;
  user: { id: string; email: string; name: string; image?: string | null };
};

function primaryRole(role: string): string {
  return role.split(",")[0]?.trim() || ORG_ROLE.CLIENT;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
}

function roleBadgeClass(role: string): string {
  switch (role) {
    case ORG_ROLE.OWNER:
      return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    case ORG_ROLE.GERANT:
    case ORG_ROLE.GESTIONNAIRE:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
    case ORG_ROLE.GUICHETIER:
      return "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100";
    case ORG_ROLE.CLIENT:
    case ORG_ROLE.PARENT:
      return "border-border bg-muted text-muted-foreground";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export default function OrganizationMembersPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.organizationId as string;

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [branchesByMember, setBranchesByMember] = useState<
    Record<string, MemberBranchSummary[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [pendingReset, startReset] = useTransition();

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const [res, branchesRes] = await Promise.all([
        authClient.organization.listMembers({
          query: { organizationId, limit: 200 },
        }),
        listOrganizationMemberBranchesAction(organizationId),
      ]);
      if (res.error) {
        toast.error(res.error.message ?? "Impossible de charger les membres.");
        setMembers([]);
        setBranchesByMember({});
        return;
      }
      const raw = res.data?.members;
      const list = Array.isArray(raw) ? (raw as MemberRow[]) : [];
      list.sort((a, b) =>
        (a.user.name || a.user.email).localeCompare(b.user.name || b.user.email, "fr"),
      );
      setMembers(list);
      setBranchesByMember(branchesRes.ok ? branchesRes.byMemberId : {});
      if (!branchesRes.ok) {
        toast.error(branchesRes.message);
      }
    } catch {
      toast.error("Erreur réseau lors du chargement des membres.");
      setMembers([]);
      setBranchesByMember({});
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return members;
    return members.filter((m) => {
      const role = primaryRole(m.role);
      const label = orgRoleLabel(role).toLowerCase();
      const branchNames = (branchesByMember[m.id] ?? [])
        .map((b) => `${b.name} ${b.code}`.toLowerCase())
        .join(" ");
      return (
        m.user.name.toLowerCase().includes(query) ||
        m.user.email.toLowerCase().includes(query) ||
        role.toLowerCase().includes(query) ||
        label.includes(query) ||
        branchNames.includes(query)
      );
    });
  }, [members, q, branchesByMember]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  function onResetPassword(m: MemberRow) {
    if (
      !window.confirm(
        `Réinitialiser le mot de passe de ${m.user.name} ? Un mot de passe temporaire sera envoyé par email.`,
      )
    ) {
      return;
    }
    setResettingId(m.id);
    startReset(async () => {
      const res = await resetOrganizationMemberPasswordAction({
        organizationId,
        memberId: m.id,
      });
      setResettingId(null);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success("Mot de passe réinitialisé. Email envoyé (ou journalisé en dev).");
    });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Équipe</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Membres</h1>
          <p className="max-w-xl text-sm text-muted-foreground">
            Gérez les comptes de l’organisation, leurs rôles et l’accès.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 touch-manipulation"
            onClick={() => void loadMembers()}
            disabled={loading}
          >
            <RefreshCw className={cn("size-4", loading && "animate-spin")} />
            Actualiser
          </Button>
          <Button
            className="h-11 touch-manipulation"
            render={<Link href={`/admin/organizations/${organizationId}/members/new`} />}
          >
            <Plus className="size-4" />
            Ajouter un membre
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Rechercher par nom, email, rôle ou branche…"
          className="w-full sm:max-w-md"
        />
        <p className="text-xs text-muted-foreground tabular-nums sm:text-sm">
          {loading ? "Chargement…" : `${filtered.length} membre${filtered.length === 1 ? "" : "s"}`}
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
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
            {members.length === 0 ? "Aucun membre pour le moment." : "Aucun résultat pour cette recherche."}
          </p>
          {members.length === 0 ? (
            <Button
              className="mt-4 h-11"
              render={<Link href={`/admin/organizations/${organizationId}/members/new`} />}
            >
              <Plus className="size-4" />
              Ajouter le premier membre
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm" role="list">
            {pageItems.map((m, index) => {
              const role = primaryRole(m.role);
              const busy = pendingReset && resettingId === m.id;
              const memberBranches = branchesByMember[m.id] ?? [];
              return (
                <li
                  key={m.id}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5",
                    index > 0 && "border-t border-border",
                  )}
                >
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                    {m.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.user.image}
                        alt=""
                        className="size-full rounded-full object-cover"
                      />
                    ) : (
                      initials(m.user.name || m.user.email)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-medium leading-snug">{m.user.name || "Sans nom"}</p>
                      <Badge
                        variant="outline"
                        className={cn("font-medium", roleBadgeClass(role))}
                      >
                        {orgRoleLabel(role)}
                      </Badge>
                    </div>
                    <p className="mt-0.5 truncate text-sm text-muted-foreground">{m.user.email}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {memberBranches.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Building2 className="size-3.5" />
                          Aucune branche
                        </span>
                      ) : (
                        memberBranches.map((b) => (
                          <Badge
                            key={b.id}
                            variant="secondary"
                            className="max-w-full gap-1 font-normal"
                          >
                            <Building2 className="size-3 shrink-0 opacity-70" />
                            <span className="truncate">
                              {b.name}
                              {b.isPrimary ? " · principale" : ""}
                            </span>
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
                      aria-label={`Actions pour ${m.user.name}`}
                      disabled={busy}
                    >
                      <MoreHorizontal className="size-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-52">
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(
                            `/admin/organizations/${organizationId}/members/${m.id}/edit`,
                          )
                        }
                      >
                        <Pencil className="size-4" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        disabled={busy}
                        onClick={() => onResetPassword(m)}
                      >
                        <KeyRound className="size-4" />
                        {busy ? "Réinitialisation…" : "Réinitialiser le mot de passe"}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-3 py-2.5 shadow-sm">
            <p className="text-xs text-muted-foreground tabular-nums">
              {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filtered.length)} sur {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Page précédente"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={cn(
                  "rounded-full",
                  safePage <= 1 && "pointer-events-none opacity-40",
                )}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-1 px-1">
                {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPage(n)}
                    aria-label={`Page ${n}`}
                    aria-current={n === safePage ? "page" : undefined}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-full text-xs font-semibold transition",
                      n === safePage
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Page suivante"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className={cn(
                  "rounded-full",
                  safePage >= pageCount && "pointer-events-none opacity-40",
                )}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </>
      )}

      <Button
        variant="ghost"
        className="h-11 touch-manipulation"
        render={<Link href={`/admin/organizations/${organizationId}`} />}
      >
        <ArrowLeft className="size-4" />
        Accueil organisation
      </Button>
    </div>
  );
}
