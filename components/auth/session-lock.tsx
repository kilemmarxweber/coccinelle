"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { LockKeyhole, LogOut } from "lucide-react";
import { restoreSessionLockContextAction } from "@/app/admin/session-lock/restore-context.action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const INACTIVE_MS = 15 * 60 * 1000;
const LOCK_STORAGE_KEY = "coccinelle:session-lock";

type LockSnapshot = {
  email: string;
  organizationId: string | null;
  branchId: string | null;
};

function parseAdminContext(pathname: string): {
  organizationId: string | null;
  branchId: string | null;
} {
  const orgMatch = pathname.match(/^\/admin\/organizations\/([^/]+)/);
  const branchMatch = pathname.match(
    /^\/admin\/organizations\/[^/]+\/branches\/([^/]+)/,
  );
  const rawBranchId = branchMatch?.[1] ?? null;
  const branchId =
    rawBranchId && !["new", "edit"].includes(rawBranchId) ? rawBranchId : null;

  return {
    organizationId: orgMatch?.[1] ?? null,
    branchId,
  };
}

function readLockSnapshot(): LockSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(LOCK_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LockSnapshot;
    if (!parsed?.email) return null;
    return {
      email: parsed.email,
      organizationId: parsed.organizationId ?? null,
      branchId: parsed.branchId ?? null,
    };
  } catch {
    return null;
  }
}

function writeLockSnapshot(snapshot: LockSnapshot) {
  sessionStorage.setItem(LOCK_STORAGE_KEY, JSON.stringify(snapshot));
}

function clearLockSnapshot() {
  sessionStorage.removeItem(LOCK_STORAGE_KEY);
}

/**
 * Soft-lock après inactivité : garde la page, demande le mot de passe.
 * Aligné sur Eteyelo, boutons peaufinés.
 */
export function SessionLock() {
  const { data: session } = useSession();
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [snapshot, setSnapshot] = useState<LockSnapshot | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockedRef = useRef(false);

  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  useEffect(() => {
    const existing = readLockSnapshot();
    if (existing) {
      lockedRef.current = true;
      setSnapshot(existing);
      setPassword("");
      setError(null);
      setLocked(true);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!locked) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [locked]);

  useEffect(() => {
    const email = session?.user?.email;
    if (!ready || !email || locked) return;

    const resetTimer = () => {
      if (lockedRef.current) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        const fromPath = parseAdminContext(window.location.pathname);
        const sessionOrgId =
          (session as { session?: { activeOrganizationId?: string | null } })
            ?.session?.activeOrganizationId ??
          (session as { organization?: { id?: string } })?.organization?.id ??
          null;

        const nextSnapshot: LockSnapshot = {
          email,
          organizationId: fromPath.organizationId ?? sessionOrgId,
          branchId: fromPath.branchId,
        };
        writeLockSnapshot(nextSnapshot);
        lockedRef.current = true;
        setSnapshot(nextSnapshot);
        setPassword("");
        setError(null);
        setLocked(true);
      }, INACTIVE_MS);
    };

    const events = [
      "mousemove",
      "keydown",
      "click",
      "scroll",
      "touchstart",
    ] as const;

    for (const event of events) {
      window.addEventListener(event, resetTimer, { passive: true });
    }
    resetTimer();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      for (const event of events) {
        window.removeEventListener(event, resetTimer);
      }
    };
  }, [session, locked, ready]);

  function unlock() {
    clearLockSnapshot();
    lockedRef.current = false;
    setLocked(false);
    setSnapshot(null);
    setPassword("");
    setError(null);
  }

  function handleUnlockSubmit(event: FormEvent) {
    event.preventDefault();
    if (!snapshot?.email || !password.trim()) {
      setError("Saisissez votre mot de passe.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const { error: signInError } = await authClient.signIn.email({
        email: snapshot.email,
        password,
      });

      if (signInError) {
        setError(
          signInError.message ??
            "Mot de passe incorrect. Vérifiez et réessayez.",
        );
        return;
      }

      const restored = await restoreSessionLockContextAction({
        organizationId: snapshot.organizationId,
      });

      if (!restored.ok) {
        setError(restored.message);
        return;
      }

      await authClient.getSession();
      unlock();
    });
  }

  async function handleSignOut() {
    clearLockSnapshot();
    try {
      await authClient.signOut();
    } catch {
      // redirect anyway
    }
    window.location.href = "/auth/sign-in";
  }

  if (!ready) return null;

  return (
    <DialogPrimitive.Root
      open={locked}
      modal
      disablePointerDismissal
      onOpenChange={(open) => {
        if (open) setLocked(true);
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            "fixed inset-0 z-[200]",
            "bg-black/45 backdrop-blur-[3px]",
            "transition-opacity duration-200 data-ending-style:opacity-0 data-starting-style:opacity-0",
          )}
        />
        <DialogPrimitive.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-[201] w-[min(calc(100vw-2rem),34rem)] -translate-x-1/2 -translate-y-1/2",
            "overflow-hidden rounded-2xl border border-border/80 bg-background shadow-2xl outline-none",
            "transition duration-200",
            "data-ending-style:scale-95 data-ending-style:opacity-0",
            "data-starting-style:scale-95 data-starting-style:opacity-0",
          )}
        >
          <div className="border-b border-border/70 bg-muted/30 px-6 py-5 sm:px-7 sm:py-6">
            <div className="flex items-start gap-4">
              <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-foreground shadow-sm">
                <LockKeyhole className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 space-y-1.5">
                <DialogPrimitive.Title className="text-lg font-semibold tracking-tight sm:text-xl">
                  Session verrouillée
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                  Inactivité détectée. Saisissez votre mot de passe pour
                  continuer sur cette page.
                </DialogPrimitive.Description>
              </div>
            </div>
          </div>

          <form onSubmit={handleUnlockSubmit} className="space-y-5 px-6 py-6 sm:px-7 sm:py-7">
            {snapshot?.email ? (
              <p className="truncate rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm font-medium tracking-wide text-foreground">
                {snapshot.email}
              </p>
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="session-lock-password" className="text-sm">
                Mot de passe
              </Label>
              <Input
                id="session-lock-password"
                type="password"
                autoComplete="current-password"
                autoFocus
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isPending}
                className="h-12 rounded-xl text-base"
              />
            </div>

            {error ? (
              <p
                className="rounded-xl border border-destructive/25 bg-destructive/5 px-3.5 py-2.5 text-sm text-destructive"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="flex flex-col-reverse gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isPending}
                onClick={() => void handleSignOut()}
                className={cn(
                  "h-11 rounded-full px-5 font-medium shadow-none",
                  "border-destructive/35 text-destructive",
                  "hover:border-destructive/50 hover:bg-destructive/10 hover:text-destructive",
                  "dark:border-destructive/40 dark:hover:bg-destructive/15",
                )}
              >
                <LogOut className="size-3.5 opacity-80" aria-hidden />
                Se déconnecter
              </Button>
              <Button
                type="submit"
                disabled={isPending || !password.trim()}
                className={cn(
                  "h-11 rounded-full px-6 font-medium",
                  "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25",
                  "hover:bg-emerald-600/90",
                  "dark:bg-emerald-500 dark:shadow-emerald-500/20 dark:hover:bg-emerald-500/90",
                )}
              >
                {isPending ? "Vérification…" : "Continuer"}
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
