"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";

type MemberRow = {
  id: string;
  userId: string;
  role: string;
  createdAt: Date | string;
  user: { id: string; email: string; name: string; image?: string | null };
};

export default function OrganizationMembersPage() {
  const params = useParams();
  const router = useRouter();
  const organizationId = params.organizationId as string;

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authClient.organization.listMembers({
        query: { organizationId, limit: 100 },
      });
      if (res.error) {
        toast.error(res.error.message ?? "Impossible de charger les membres.");
        setMembers([]);
        return;
      }
      const raw = res.data?.members;
      setMembers(Array.isArray(raw) ? (raw as MemberRow[]) : []);
    } catch {
      toast.error("Erreur réseau lors du chargement des membres.");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-8 md:max-w-4xl md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          className="h-12 min-h-[48px] touch-manipulation sm:h-11 sm:min-h-0"
          render={<Link href={`/admin/organizations/${organizationId}/members/new`} />}
        >
          Ajouter un membre
        </Button>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold leading-snug">Membres</h2>
          <Button
            type="button"
            variant="outline"
            className="h-11 min-h-[44px] touch-manipulation"
            onClick={() => void loadMembers()}
            disabled={loading}
          >
            Actualiser
          </Button>
        </div>
        <Separator />
        {loading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun membre pour le moment.</p>
        ) : (
          <ul className="flex flex-col gap-3" role="list">
            {members.map((m) => (
              <li key={m.id} className="rounded-xl bg-muted/40 px-4 py-4 sm:px-5 sm:py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium leading-snug wrap-break-word">{m.user.name}</p>
                    <p className="break-all text-sm leading-relaxed text-muted-foreground">{m.user.email}</p>
                  </div>  
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
                      aria-label={`Actions pour ${m.user.name}`}
                    >
                      <MoreHorizontal className="size-5" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-40">
                      <DropdownMenuItem
                        onClick={() =>
                          router.push(`/admin/organizations/${organizationId}/members/${m.id}/edit`)
                        }
                      >
                        Modifier
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        variant="ghost"
        className="h-11 min-h-[44px] w-full justify-center touch-manipulation sm:w-fit sm:justify-start sm:px-3"
        render={<Link href={`/admin/organizations/${organizationId}`} />}
      >
        ← Accueil organisation
      </Button>
    </div>
  );
}
