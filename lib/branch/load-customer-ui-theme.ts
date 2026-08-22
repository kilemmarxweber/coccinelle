import prisma from "@/lib/prisma";
import {
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

export async function loadBranchCustomerUiTheme(branchId: string): Promise<{
  theme: CustomerUiTheme;
  isCustom: boolean;
}> {
  const row = await prisma.branch.findUnique({
    where: { id: branchId },
    select: THEME_SELECT,
  });
  return {
    theme: parseCustomerUiTheme(row),
    isCustom: hasCustomCustomerUi(row),
  };
}

/** Thème PWA : branche custom si présente, sinon première branche active. */
export async function loadOrganizationCustomerUiTheme(
  organizationId: string,
): Promise<{ theme: CustomerUiTheme; isCustom: boolean }> {
  const rows = await prisma.branch.findMany({
    where: { organizationId, status: "ACTIVE" },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: THEME_SELECT,
  });
  const row = rows.find((item) => hasCustomCustomerUi(item)) ?? rows[0] ?? null;
  return {
    theme: parseCustomerUiTheme(row),
    isCustom: hasCustomCustomerUi(row),
  };
}
