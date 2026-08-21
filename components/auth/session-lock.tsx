"use client";

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import { usePathname } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import { restoreSessionLockContextAction } from "@/app/admin/session-lock/restore-context.action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient, useSession } from "@/lib/auth-client";

const INACTIVE_MS = 15 * 60 * 1000;
const LOCK_STORAGE_KEY = "coccinelle:session-lock";

function isIdleSkipPath(pathname: string) {
  return pathname.startsWith("/auth");
}

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
 * Design aligné sur HK+.
 */
export function SessionLock() {
  const pathname = usePathname();
  const skipIdle = isIdleSkipPath(pathname);
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
    if (!skipIdle) {
      const existing = readLockSnapshot();
      if (existing) {
        lockedRef.current = true;
        setSnapshot(existing);
        setPassword("");
        setError(null);
        setLocked(true);
      }
    }
    setReady(true);
  }, [skipIdle]);

  useEffect(() => {
    if (!locked || skipIdle) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [locked, skipIdle]);

  useEffect(() => {
    const email = session?.user?.email;
    if (!ready || !email || locked || skipIdle) return;

    const resetTimer = () => {
      if (lockedRef.current) return;
      if (document.querySelector('[data-idle-logout="off"]')) return;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        if (document.querySelector('[data-idle-logout="off"]')) return;
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
  }, [session, locked, ready, skipIdle]);

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

  if (!ready || skipIdle || !locked) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-3 backdrop-blur-[2px] sm:p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="session-lock-title"
        aria-describedby="session-lock-desc"
        className="w-[min(calc(100vw-1.5rem),40rem)] overflow-hidden rounded-xl border border-border/70 bg-popover text-popover-foreground shadow-xl"
      >
        <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4 sm:px-6">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <LockKeyhole className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2
              id="session-lock-title"
              className="text-base font-semibold tracking-tight sm:text-lg"
            >
              Session verrouillée
            </h2>
            <p
              id="session-lock-desc"
              className="text-sm leading-snug text-muted-foreground"
            >
              Mot de passe pour continuer sur cette page.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleUnlockSubmit}
          className="space-y-4 px-5 py-5 sm:px-6"
        >
          {snapshot?.email ? (
            <p className="truncate text-xs font-medium text-muted-foreground">
              {snapshot.email}
            </p>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="session-lock-password">Mot de passe</Label>
            <Input
              id="session-lock-password"
              type="password"
              autoComplete="current-password"
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={isPending}
              className="h-11"
              placeholder="Votre mot de passe"
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          <div className="grid grid-cols-1 gap-2 pt-1 min-[400px]:grid-cols-2">
            <Button
              type="button"
              className="h-11 rounded-md bg-red-600 text-white hover:bg-red-700"
              disabled={isPending}
              onClick={() => void handleSignOut()}
            >
              Se déconnecter
            </Button>
            <Button
              type="submit"
              className="h-11 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isPending || !password.trim()}
            >
              {isPending ? "Vérification…" : "Continuer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
