import prisma from "@/lib/prisma";
import {
  DEFAULT_CUSTOMER_UI_THEME,
  hasCustomCustomerUi,
  parseCustomerUiTheme,
  type CustomerUiTheme,
} from "@/lib/branch/customer-ui-theme";

const THEME_SELECT = {
  customerUiPrimary: true,
  customerUiBackground: true,
  customerUiCard: true,
  settings: true,
} as const;

const SETTINGS_ONLY_SELECT = {
  settings: true,
} as const;

function isMissingBranchUiColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    code?: string;
    meta?: { modelName?: string; column?: string };
    message?: string;
  };
  if (e.code === "P2022") return true;
  const msg = e.message ?? "";
  return (
    msg.includes("customerUiPrimary") ||
    msg.includes("customerUiBackground") ||
    msg.includes("customerUiCard") ||
    msg.includes("ColumnNotFound")
  );
}

type ThemeRow = {
  customerUiPrimary?: string | null;
  customerUiBackground?: string | null;
  customerUiCard?: string | null;
  settings?: unknown;
} | null;

async function fetchBranchThemeRow(branchId: string): Promise<ThemeRow> {
  try {
    return await prisma.branch.findUnique({
      where: { id: branchId },
      select: THEME_SELECT,
    });
  } catch (error) {
    if (!isMissingBranchUiColumn(error)) throw error;
    // Migration pas encore appliquée sur cette DB : lire settings seulement.
    return prisma.branch.findUnique({
      where: { id: branchId },
      select: SETTINGS_ONLY_SELECT,
    });
  }
}

export async function loadBranchCustomerUiTheme(branchId: string): Promise<{
  theme: CustomerUiTheme;
  isCustom: boolean;
}> {
  try {
    const row = await fetchBranchThemeRow(branchId);
    return {
      theme: parseCustomerUiTheme(row),
      isCustom: hasCustomCustomerUi(row),
    };
  } catch {
    return { theme: DEFAULT_CUSTOMER_UI_THEME, isCustom: false };
  }
}

/** Thème PWA : branche custom si présente, sinon première branche active. */
export async function loadOrganizationCustomerUiTheme(
  organizationId: string,
): Promise<{ theme: CustomerUiTheme; isCustom: boolean }> {
  try {
    let rows: ThemeRow[];
    try {
      rows = await prisma.branch.findMany({
        where: { organizationId, status: "ACTIVE" },
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: THEME_SELECT,
      });
    } catch (error) {
      if (!isMissingBranchUiColumn(error)) throw error;
      rows = await prisma.branch.findMany({
        where: { organizationId, status: "ACTIVE" },
        orderBy: [{ type: "asc" }, { name: "asc" }],
        select: SETTINGS_ONLY_SELECT,
      });
    }
    const row = rows.find((item) => hasCustomCustomerUi(item)) ?? rows[0] ?? null;
    return {
      theme: parseCustomerUiTheme(row),
      isCustom: hasCustomCustomerUi(row),
    };
  } catch {
    return { theme: DEFAULT_CUSTOMER_UI_THEME, isCustom: false };
  }
}
