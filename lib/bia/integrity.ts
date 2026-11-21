export type IntegrityDraft = {
  ruleCode: string;
  severity: "INFO" | "MOYENNE" | "ELEVEE" | "CRITIQUE";
  title: string;
  detail: string;
  entityType: string;
  entityId: string;
  branchId: string | null;
};

export function findingFingerprint(ruleCode: string, entityId: string) {
  return `${ruleCode}:${entityId}`;
}

type SaleProbe = {
  id: string;
  ticketNumber: string;
  branchId: string;
  items: { productId: string | null; quantity: number }[];
  stockMovements: { kind: string; productId: string; quantity: number }[];
};

/** Vente encaissée dont une ligne catalogue n'a pas la sortie de stock attendue. */
export function saleWithoutStockDrafts(sales: SaleProbe[]): IntegrityDraft[] {
  const drafts: IntegrityDraft[] = [];
  for (const sale of sales) {
    const sortie = new Map<string, number>();
    for (const move of sale.stockMovements) {
      if (move.kind !== "SORTIE") continue;
      sortie.set(move.productId, (sortie.get(move.productId) ?? 0) + move.quantity);
    }
    const missing = sale.items.filter((item) => {
      if (!item.productId) return false;
      return (sortie.get(item.productId) ?? 0) < item.quantity;
    });
    if (missing.length === 0) continue;
    drafts.push({
      ruleCode: "VENTE_SANS_SORTIE",
      severity: "ELEVEE",
      title: `Vente ${sale.ticketNumber} sans sortie de stock`,
      detail: `${missing.length} ligne(s) catalogue sans mouvement SORTIE correspondant.`,
      entityType: "ShopSale",
      entityId: sale.id,
      branchId: sale.branchId,
    });
  }
  return drafts;
}
