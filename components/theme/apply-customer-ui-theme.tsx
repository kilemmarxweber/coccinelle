"use client";

import { useEffect } from "react";
import {
  customerUiCssText,
  customerUiCssVars,
  type CustomerUiTheme,
} from "@/lib/branch/customer-ui-theme";

function applyVars(theme: CustomerUiTheme) {
  const root = document.documentElement;
  const vars = customerUiCssVars(theme);
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

function clearVars(theme: CustomerUiTheme) {
  const root = document.documentElement;
  for (const key of Object.keys(customerUiCssVars(theme))) {
    root.style.removeProperty(key);
  }
}

/** Injecte les couleurs de branche sur `html` (workspace + PWA client). */
export function ApplyCustomerUiTheme({
  theme,
  enabled = true,
}: {
  theme: CustomerUiTheme;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;
    applyVars(theme);
    return () => clearVars(theme);
  }, [enabled, theme.primary, theme.background, theme.card]);

  if (!enabled) return null;

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `html{${customerUiCssText(theme)}}`,
      }}
    />
  );
}
