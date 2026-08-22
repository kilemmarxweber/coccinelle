"use client";

import { useEffect, useRef } from "react";
import { bumpBranchLiveAction } from "@/lib/branch/live-refresh-actions";

const DEFAULT_MS = 12_000;

/**
 * En prod, `router.refresh()` ne perce pas le cache client Next 16.
 * On compare une empreinte (server action) puis on force le refresh RSC.
 */
export function useLiveRefresh(
  fingerprint: () => Promise<string>,
  intervalMs = DEFAULT_MS,
) {
  const fpRef = useRef<string | null>(null);
  const fingerprintRef = useRef(fingerprint);
  fingerprintRef.current = fingerprint;

  useEffect(() => {
    let cancelled = false;
    fpRef.current = null;

    async function check() {
      if (document.visibilityState === "hidden") return;
      try {
        const next = await fingerprintRef.current();
        if (cancelled) return;
        if (fpRef.current != null && fpRef.current !== next) {
          await bumpBranchLiveAction();
        }
        fpRef.current = next;
      } catch {
        /* onglet inactif / réseau */
      }
    }

    void check();
    const id = window.setInterval(() => {
      void check();
    }, intervalMs);
    function onVis() {
      if (document.visibilityState === "visible") void check();
    }
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [intervalMs]);
}
