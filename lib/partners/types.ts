export const PARTNER_PAY_TIMINGS = ["PREPAID", "AT_CHECKOUT"] as const;
export type PartnerPayTiming = (typeof PARTNER_PAY_TIMINGS)[number];

export type PartnerPaymentMethod = "CASH" | "MOBILE_MONEY" | "CARTE" | "BANK";

export function partnerPayTimingLabel(timing: string): string {
  return timing === "PREPAID" ? "Avant séjour" : "À la fin";
}

export type BranchPartnerDTO = {
  id: string;
  branchId: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string;
  city: string;
  taxId: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  defaultUnitPriceHint: number | null;
  defaultDiscountPctHint: number | null;
  createdAt: string | Date;
  updatedAt: string | Date;
};
