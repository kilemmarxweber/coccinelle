"use server";

import { revalidatePath } from "next/cache";
import { DASH_CARD } from "@/lib/branch/ops-roles";
import { branchBasePath } from "@/lib/branch/paths";
import {
  assertBranchPrivilege,
  createBranchRole,
  deleteBranchRole,
  listBranchRolesWithPrivileges,
  resetRolePrivilegesToSeed,
  saveRolePrivileges,
  updateBranchRole,
} from "@/lib/branch/privileges";
import type { PrivilegeActionName } from "@/lib/branch/privilege-seed";

function revalidateParametres(organizationId: string, branchId: string) {
  revalidatePath(branchBasePath(organizationId, branchId));
  revalidatePath(`${branchBasePath(organizationId, branchId)}/parametres`);
}

export async function listRolesForParametresAction(
  organizationId: string,
  branchId: string,
) {
  await assertBranchPrivilege({
    organizationId,
    branchId,
    resource: DASH_CARD.PARAMETRES,
    action: "VIEW",
  });
  const roles = await listBranchRolesWithPrivileges();
  return roles.map((r) => ({
    id: r.id,
    slug: r.slug,
    label: r.label,
    description: r.description,
    isSystem: r.isSystem,
    sortOrder: r.sortOrder,
    privileges: r.privileges.map((p) => ({
      resource: p.resource,
      action: p.action as PrivilegeActionName,
      allowed: p.allowed,
    })),
  }));
}

/** Liste légère pour select métier (création / édition membre). */
export async function listAssignableOpsRolesAction() {
  const { listAssignableBranchRolesAction } = await import(
    "@/lib/branch/privileges"
  );
  return listAssignableBranchRolesAction();
}

export async function saveRolePrivilegesAction(input: {
  organizationId: string;
  branchId: string;
  slug: string;
  privileges: {
    resource: string;
    action: PrivilegeActionName;
    allowed: boolean;
  }[];
}) {
  await assertBranchPrivilege({
    organizationId: input.organizationId,
    branchId: input.branchId,
    resource: DASH_CARD.PARAMETRES,
    action: "UPDATE",
  });
  await saveRolePrivileges({
    slug: input.slug,
    privileges: input.privileges,
  });
  revalidateParametres(input.organizationId, input.branchId);
  return { ok: true as const };
}

export async function resetRoleToSeedAction(input: {
  organizationId: string;
  branchId: string;
  slug: string;
}) {
  await assertBranchPrivilege({
    organizationId: input.organizationId,
    branchId: input.branchId,
    resource: DASH_CARD.PARAMETRES,
    action: "UPDATE",
  });
  await resetRolePrivilegesToSeed(input.slug);
  revalidateParametres(input.organizationId, input.branchId);
  return { ok: true as const };
}

export async function createBranchRoleAction(input: {
  organizationId: string;
  branchId: string;
  label: string;
  description?: string;
  slug?: string;
  cloneFromSlug?: string;
}) {
  await assertBranchPrivilege({
    organizationId: input.organizationId,
    branchId: input.branchId,
    resource: DASH_CARD.PARAMETRES,
    action: "UPDATE",
  });
  const created = await createBranchRole({
    label: input.label,
    description: input.description,
    slug: input.slug,
    cloneFromSlug: input.cloneFromSlug,
  });
  revalidateParametres(input.organizationId, input.branchId);
  return { ok: true as const, ...created };
}

export async function updateBranchRoleAction(input: {
  organizationId: string;
  branchId: string;
  slug: string;
  label: string;
  description?: string;
}) {
  await assertBranchPrivilege({
    organizationId: input.organizationId,
    branchId: input.branchId,
    resource: DASH_CARD.PARAMETRES,
    action: "UPDATE",
  });
  await updateBranchRole({
    slug: input.slug,
    label: input.label,
    description: input.description,
  });
  revalidateParametres(input.organizationId, input.branchId);
  return { ok: true as const };
}

export async function deleteBranchRoleAction(input: {
  organizationId: string;
  branchId: string;
  slug: string;
}) {
  await assertBranchPrivilege({
    organizationId: input.organizationId,
    branchId: input.branchId,
    resource: DASH_CARD.PARAMETRES,
    action: "UPDATE",
  });
  await deleteBranchRole(input.slug);
  revalidateParametres(input.organizationId, input.branchId);
  return { ok: true as const };
}
