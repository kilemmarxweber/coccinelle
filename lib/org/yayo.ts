/**
 * Identité campus CAFE YAYO : vertical stockée dans Organization.metadata (JSON).
 * Départements CDC = branches typées, sans voyage ni séjours hôtel.
 */

export const YAYO_VERTICAL = "cafe_yayo" as const;

export type OrgMetadata = {
  vertical?: string;
  cafeYayo?: boolean;
};

export type YayoDepartmentTemplate = {
  name: string;
  code: string;
  formType: "BOUTIQUE" | "HOTEL" | "USINE";
  hasAlimentation?: boolean;
  hasShop?: boolean;
  hasRestaurant?: boolean;
  hasStays?: boolean;
  hasProduction?: boolean;
};

export const YAYO_DEPARTMENTS: YayoDepartmentTemplate[] = [
  {
    name: "Mini Market",
    code: "MMKT",
    formType: "BOUTIQUE",
    hasAlimentation: true,
    hasShop: true,
  },
  {
    name: "Boissons",
    code: "BOIS",
    formType: "BOUTIQUE",
    hasShop: true,
    hasAlimentation: true,
  },
  {
    name: "Fast Food",
    code: "FFOD",
    formType: "HOTEL",
    hasRestaurant: true,
    hasStays: false,
    hasProduction: true,
  },
  {
    name: "Buffet",
    code: "BUFF",
    formType: "HOTEL",
    hasRestaurant: true,
    hasStays: false,
    hasProduction: true,
  },
  {
    name: "Crèmerie, Jeux et Divers",
    code: "CREM",
    formType: "HOTEL",
    hasRestaurant: true,
    hasStays: false,
    hasProduction: true,
  },
  {
    name: "Charcuterie",
    code: "CHAR",
    formType: "USINE",
    hasProduction: true,
  },
];

export const YAYO_ALLOWED_FORM_TYPES = ["BOUTIQUE", "HOTEL", "USINE"] as const;

export function parseOrgMetadata(raw: string | null | undefined): OrgMetadata {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as OrgMetadata;
  } catch {
    return {};
  }
}

export function serializeOrgMetadata(meta: OrgMetadata): string {
  return JSON.stringify(meta);
}

export function isCafeYayoOrg(org: {
  metadata?: string | null;
  name?: string | null;
  slug?: string | null;
}): boolean {
  const meta = parseOrgMetadata(org.metadata);
  if (meta.vertical === YAYO_VERTICAL || meta.cafeYayo === true) return true;
  const blob = `${org.name ?? ""} ${org.slug ?? ""}`;
  return /cafe[\s-]?yayo/i.test(blob);
}

export function withYayoVertical(
  raw: string | null | undefined,
  enabled: boolean,
): string {
  const meta = parseOrgMetadata(raw);
  if (enabled) {
    meta.vertical = YAYO_VERTICAL;
    meta.cafeYayo = true;
  } else {
    if (meta.vertical === YAYO_VERTICAL) delete meta.vertical;
    delete meta.cafeYayo;
  }
  return serializeOrgMetadata(meta);
}

export function yayoSiteLabel(isYayo: boolean): {
  branch: string;
  branches: string;
  newBranch: string;
} {
  if (isYayo) {
    return {
      branch: "Département",
      branches: "Départements",
      newBranch: "Nouveau département",
    };
  }
  return {
    branch: "Branche",
    branches: "Branches",
    newBranch: "Nouvelle branche",
  };
}
