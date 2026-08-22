"use server";

import { revalidatePath } from "next/cache";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { branchBasePath } from "@/lib/branch/paths";
import { assertBranchPrivilege } from "@/lib/branch/privileges";
import {
  DEFAULT_CUSTOMER_UI_THEME,
  hasCustomCustomerUi,
  parseCustomerUiTheme,
  serializeCustomerUiForDb,
  type CustomerUiTheme,
} from "@/lib/branch/customer-ui-theme";
import { loadBranchCustomerUiTheme } from "@/lib/branch/load-customer-ui-theme";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/prisma/generated/prisma/client";

const THEME_SELECT = {
  customerUiPrimary: true,
  customerUiBackground: true,
  customerUiCard: true,
  settings: true,
  organization: { select: { slug: true } },
} as const;

function asSettingsObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...(value as Record<string, unknown>) };
  }
  return {};
}

function revalidateCustomerUi(
  organizationId: string,
  branchId: string,
  orgSlug?: string | null,
) {
  const base = branchBasePath(organizationId, branchId);
  revalidatePath(base);
  revalidatePath(`${base}/parametres`);
  revalidatePath(`${base}/parametres/apparence`);
  revalidatePath(
    `/admin/organizations/${organizationId}/branches/${branchId}`,
    "layout",
  );
  if (orgSlug) {
    revalidatePath(`/${orgSlug}`);
    revalidatePath(`/${orgSlug}`, "layout");
  }
}

export async function loadCustomerUiThemeAction(
  organizationId: string,
  branchId: string,
): Promise<{ theme: CustomerUiTheme; isCustom: boolean }> {
  await assertBranchPrivilege({
    organizationId,
    branchId,
    resource: DASH_CARD.PARAMETRES,
    action: "VIEW",
  });
  return loadBranchCustomerUiTheme(branchId);
}

export async function saveCustomerUiThemeAction(input: {
  organizationId: string;
  branchId: string;
  theme: CustomerUiTheme;
}): Promise<{ ok: true; theme: CustomerUiTheme; isCustom: boolean }> {
  await assertBranchPrivilege({
    organizationId: input.organizationId,
    branchId: input.branchId,
    resource: DASH_CARD.PARAMETRES,
    action: "UPDATE",
  });

  const existing = await prisma.branch.findFirst({
    where: { id: input.branchId, organizationId: input.organizationId },
    select: THEME_SELECT,
  });
  if (!existing) throw new Error("Branche introuvable.");

  const serialized = serializeCustomerUiForDb(input.theme);
  const settings = asSettingsObject(existing.settings);
  if (serialized.customerUi) {
    settings.customerUi = serialized.customerUi;
  } else {
    delete settings.customerUi;
  }

  const updated = await prisma.branch.update({
    where: { id: input.branchId },
    data: {
      customerUiPrimary: serialized.customerUiPrimary,
      customerUiBackground: serialized.customerUiBackground,
      customerUiCard: serialized.customerUiCard,
      settings: settings as Prisma.InputJsonValue,
    },
    select: THEME_SELECT,
  });

  revalidateCustomerUi(
    input.organizationId,
    input.branchId,
    updated.organization.slug,
  );

  return {
    ok: true as const,
    theme: parseCustomerUiTheme(updated),
    isCustom: hasCustomCustomerUi(updated),
  };
}

export async function resetCustomerUiThemeAction(input: {
  organizationId: string;
  branchId: string;
}): Promise<{ ok: true; theme: CustomerUiTheme; isCustom: boolean }> {
  return saveCustomerUiThemeAction({
    ...input,
    theme: DEFAULT_CUSTOMER_UI_THEME,
  });
}
