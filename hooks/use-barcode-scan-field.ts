"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";

type Options = {
  /** Min longueur avant de traiter Enter comme un scan (défaut 3). */
  minLength?: number;
  enabled?: boolean;
  /** Auto-focus au montage. */
  autoFocus?: boolean;
};

/**
 * Champ dédié lecteur USB (wedge) : buffer + Enter → onScan(code).
 * Chaque scan réussi doit appeler clear() côté parent ou on laisse
 * le hook vider le champ après onScan.
 */
export function useBarcodeScanField(
  onScan: (code: string) => void,
  options: Options = {},
) {
  const { minLength = 3, enabled = true, autoFocus = true } = options;
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    if (!enabled || !autoFocus) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(t);
  }, [enabled, autoFocus]);

  const commit = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (code.length < minLength) return false;
      onScanRef.current(code);
      setValue("");
      return true;
    },
    [minLength],
  );

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!enabled) return;
    if (e.key !== "Enter") return;
    e.preventDefault();
    e.stopPropagation();
    commit(value || e.currentTarget.value);
  }

  function focus() {
    inputRef.current?.focus();
  }

  function clear() {
    setValue("");
  }

  return {
    inputRef: inputRef as RefObject<HTMLInputElement | null>,
    value,
    setValue,
    onKeyDown,
    focus,
    clear,
    commit,
  };
}
