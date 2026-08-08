import {
  menuSectionsForBranch,
  type BranchMenuItem,
  type BranchMenuSection,
} from "@/lib/branch/branch-menus";
import { hasOrganizationPermission } from "@/lib/hotel/hotel-permission";

/**
 * Filtre les cartes du hub branche selon les permissions Better Auth
 * (shells hôtel units-03 : réception / serveur / gérant / owner).
 */
export async function resolveBranchMenuSections(
  organizationId: string,
  branchId: string,
  type: "AGENCE" | "HOTEL" | "BOUTIQUE" | string,
): Promise<BranchMenuSection[]> {
  const sections = menuSectionsForBranch(organizationId, branchId, type);

  if (type !== "HOTEL") {
    return sections;
  }

  const resolved: BranchMenuSection[] = [];

  for (const section of sections) {
    const items: BranchMenuItem[] = [];
    for (const item of section.items) {
      if (!item.permission) {
        items.push(item);
        continue;
      }
      const allowed = await hasOrganizationPermission(
        organizationId,
        item.permission,
      );
      if (allowed) items.push(item);
    }
    if (items.length > 0) {
      resolved.push({ ...section, items });
    }
  }

  return resolved;
}
