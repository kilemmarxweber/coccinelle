/** Prix effectif catalogue vs promotion produit. */

export type PromoFields = {
  price: number;
  promoActive: boolean;
  promoPrice: number | null;
  promoStartsAt?: Date | string | null;
  promoEndsAt?: Date | string | null;
};

export function isPromoCurrentlyActive(p: PromoFields, now = new Date()): boolean {
  if (!p.promoActive || p.promoPrice == null) return false;
  if (p.promoPrice < 0 || p.promoPrice >= p.price) return false;
  if (p.promoStartsAt) {
    const start = new Date(p.promoStartsAt);
    if (now < start) return false;
  }
  if (p.promoEndsAt) {
    const end = new Date(p.promoEndsAt);
    if (now > end) return false;
  }
  return true;
}

export function effectivePrice(p: PromoFields, now = new Date()): number {
  return isPromoCurrentlyActive(p, now) ? (p.promoPrice as number) : p.price;
}

export function generateAnonymousCode(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `ANON-${n}`;
}
