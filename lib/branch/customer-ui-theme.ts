/**
 * Thème « interface client » d’une branche : couleurs de base
 * (accent, fond, cartes) persistées en colonne + miroir `settings.customerUi`.
 */

export type CustomerUiTheme = {
  primary: string;
  background: string;
  card: string;
};

export const DEFAULT_CUSTOMER_UI_THEME: CustomerUiTheme = {
  primary: "#E8871A",
  background: "#F3F3F3",
  card: "#FFFFFF",
};

export type CustomerUiPreset = {
  id: string;
  label: string;
  theme: CustomerUiTheme;
  /** Orange Coccinelle : colonnes NULL, tokens CSS d’origine. */
  systemDefault?: boolean;
};

export const CUSTOMER_UI_PRESETS: CustomerUiPreset[] = [
  {
    id: "orange",
    label: "Orange",
    theme: DEFAULT_CUSTOMER_UI_THEME,
    systemDefault: true,
  },
  {
    id: "bleu",
    label: "Bleu",
    theme: {
      primary: "#2563EB",
      background: "#F3F3F3",
      card: "#FFFFFF",
    },
  },
  {
    id: "vert",
    label: "Vert",
    theme: {
      primary: "#15803D",
      background: "#F3F3F3",
      card: "#FFFFFF",
    },
  },
  {
    id: "rouge",
    label: "Rouge",
    theme: {
      primary: "#DC2626",
      background: "#F3F3F3",
      card: "#FFFFFF",
    },
  },
  {
    id: "violet",
    label: "Violet",
    theme: {
      primary: "#7C3AED",
      background: "#F3F3F3",
      card: "#FFFFFF",
    },
  },
  {
    id: "ardoise",
    label: "Ardoise",
    theme: {
      primary: "#334155",
      background: "#F3F3F3",
      card: "#FFFFFF",
    },
  },
];

const HEX = /^#([0-9A-Fa-f]{6})$/;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

export function normalizeHexColor(
  value: unknown,
  fallback: string,
): string {
  if (!isHexColor(value)) return fallback.toUpperCase();
  return `#${value.trim().slice(1).toUpperCase()}`;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function themeFromUnknown(value: unknown): Partial<CustomerUiTheme> | null {
  if (!isPlainObject(value)) return null;
  const theme: Partial<CustomerUiTheme> = {};
  if (isHexColor(value.primary)) {
    theme.primary = normalizeHexColor(
      value.primary,
      DEFAULT_CUSTOMER_UI_THEME.primary,
    );
  }
  if (isHexColor(value.background)) {
    theme.background = normalizeHexColor(
      value.background,
      DEFAULT_CUSTOMER_UI_THEME.background,
    );
  }
  if (isHexColor(value.card)) {
    theme.card = normalizeHexColor(
      value.card,
      DEFAULT_CUSTOMER_UI_THEME.card,
    );
  }
  return Object.keys(theme).length ? theme : null;
}

export type CustomerUiThemeSource = {
  customerUiPrimary?: string | null;
  customerUiBackground?: string | null;
  customerUiCard?: string | null;
  settings?: unknown;
};

export function parseCustomerUiTheme(
  source: CustomerUiThemeSource | null | undefined,
): CustomerUiTheme {
  const fromColumns = {
    primary: isHexColor(source?.customerUiPrimary)
      ? normalizeHexColor(
          source.customerUiPrimary,
          DEFAULT_CUSTOMER_UI_THEME.primary,
        )
      : undefined,
    background: isHexColor(source?.customerUiBackground)
      ? normalizeHexColor(
          source.customerUiBackground,
          DEFAULT_CUSTOMER_UI_THEME.background,
        )
      : undefined,
    card: isHexColor(source?.customerUiCard)
      ? normalizeHexColor(source.customerUiCard, DEFAULT_CUSTOMER_UI_THEME.card)
      : undefined,
  };
  const hasColumn = Boolean(
    fromColumns.primary || fromColumns.background || fromColumns.card,
  );
  const settingsUi = isPlainObject(source?.settings)
    ? themeFromUnknown(source.settings.customerUi)
    : null;
  const fallback = hasColumn ? null : settingsUi;

  return {
    primary:
      fromColumns.primary ?? fallback?.primary ?? DEFAULT_CUSTOMER_UI_THEME.primary,
    background:
      fromColumns.background ??
      fallback?.background ??
      DEFAULT_CUSTOMER_UI_THEME.background,
    card: fromColumns.card ?? fallback?.card ?? DEFAULT_CUSTOMER_UI_THEME.card,
  };
}

export function hasCustomCustomerUi(
  source: CustomerUiThemeSource | null | undefined,
): boolean {
  if (!source) return false;
  if (
    source.customerUiPrimary ||
    source.customerUiBackground ||
    source.customerUiCard
  ) {
    return true;
  }
  return Boolean(
    isPlainObject(source.settings) &&
      themeFromUnknown(source.settings.customerUi),
  );
}

export function themesEqual(a: CustomerUiTheme, b: CustomerUiTheme): boolean {
  return (
    a.primary === b.primary &&
    a.background === b.background &&
    a.card === b.card
  );
}

export function matchingCustomerUiPresetId(
  theme: CustomerUiTheme,
): string | "custom" {
  const match = CUSTOMER_UI_PRESETS.find((p) => themesEqual(p.theme, theme));
  return match?.id ?? "custom";
}

export function serializeCustomerUiForDb(theme: CustomerUiTheme): {
  customerUiPrimary: string | null;
  customerUiBackground: string | null;
  customerUiCard: string | null;
  customerUi: CustomerUiTheme | null;
} {
  const normalized: CustomerUiTheme = {
    primary: normalizeHexColor(theme.primary, DEFAULT_CUSTOMER_UI_THEME.primary),
    background: normalizeHexColor(
      theme.background,
      DEFAULT_CUSTOMER_UI_THEME.background,
    ),
    card: normalizeHexColor(theme.card, DEFAULT_CUSTOMER_UI_THEME.card),
  };
  if (themesEqual(normalized, DEFAULT_CUSTOMER_UI_THEME)) {
    return {
      customerUiPrimary: null,
      customerUiBackground: null,
      customerUiCard: null,
      customerUi: null,
    };
  }
  return {
    customerUiPrimary: normalized.primary,
    customerUiBackground: normalized.background,
    customerUiCard: normalized.card,
    customerUi: normalized,
  };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = normalizeHexColor(hex, "#000000").slice(1);
  return [
    Number.parseInt(n.slice(0, 2), 16),
    Number.parseInt(n.slice(2, 4), 16),
    Number.parseInt(n.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.min(255, Math.max(0, Math.round(v)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function channelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

export function contrastingForeground(hex: string): string {
  return relativeLuminance(hex) > 0.45 ? "#1A1612" : "#FFFFFF";
}

function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}

function isLightHex(hex: string): boolean {
  return relativeLuminance(hex) > 0.45;
}

export type CustomerUiCssVars = Record<`--${string}`, string>;

export function customerUiCssVars(theme: CustomerUiTheme): CustomerUiCssVars {
  const primaryFg = contrastingForeground(theme.primary);
  const bgFg = contrastingForeground(theme.background);
  const cardFg = contrastingForeground(theme.card);
  const lightBg = isLightHex(theme.background);
  const muted = mixHex(theme.background, lightBg ? "#000000" : "#FFFFFF", 0.06);
  const border = mixHex(theme.background, lightBg ? "#000000" : "#FFFFFF", 0.12);
  const accent = mixHex(theme.background, theme.primary, 0.12);
  const mutedFg = mixHex(bgFg, theme.background, 0.42);

  return {
    "--primary": theme.primary,
    "--primary-foreground": primaryFg,
    "--ring": theme.primary,
    "--chart-1": theme.primary,
    "--background": theme.background,
    "--foreground": bgFg,
    "--card": theme.card,
    "--card-foreground": cardFg,
    "--popover": theme.card,
    "--popover-foreground": cardFg,
    "--muted": muted,
    "--muted-foreground": mutedFg,
    "--accent": accent,
    "--accent-foreground": bgFg,
    "--border": border,
    "--input": border,
    "--sidebar-primary": theme.primary,
    "--sidebar-primary-foreground": primaryFg,
    "--sidebar-ring": theme.primary,
  };
}

export function customerUiCssText(theme: CustomerUiTheme): string {
  return Object.entries(customerUiCssVars(theme))
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}
