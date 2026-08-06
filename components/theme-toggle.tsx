"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@teispace/next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
};

/**
 * Bascule light / dark.
 * Un seul arbre DOM avant/après hydratation (pas de `disabled` Base UI,
 * qui diverge SSR `null` vs client `true`).
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("size-9 shrink-0", className)}
      aria-label={
        !mounted
          ? "Changer le thème"
          : isDark
            ? "Passer en mode clair"
            : "Passer en mode sombre"
      }
      title={!mounted ? "Thème" : isDark ? "Mode clair" : "Mode sombre"}
      onClick={() => {
        if (!mounted) return;
        setTheme(isDark ? "light" : "dark");
      }}
    >
      {isDark ? (
        <Sun className="size-4 text-primary" />
      ) : (
        <Moon className="size-4" />
      )}
    </Button>
  );
}
