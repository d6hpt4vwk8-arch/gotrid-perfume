import type { FeedProduct } from "./get-feed-products";
import { isGoogleListable } from "./google-exclusions";
import { ARABIC_PERFUME_BRANDS } from "./paid-ads-eligibility";
import { isValidEan } from "./xml";

/**
 * "Start wave" for the new Merchant Center account: a small, deliberately safe slice of the catalogue that is
 * submitted first, so Google reviews what we chose rather than every crawled page. Only products where we have the
 * strongest story — Korean cosmetics bought straight from the distributor (GVS-), Palacio's own cosmetics (PAL-) and
 * the Arabic perfume houses (cheap by nature, nothing to counterfeit-flag) — and only complete rows: in stock, valid
 * GTIN, brand, an image and a real description, no promo wording in the title. Widen it in steps once Merchant
 * Center has approved the first wave (mass drugstore brands next, then candles and home fragrance).
 */
export function isGoogleStartWave(p: FeedProduct): boolean {
  if (!isGoogleListable(p)) return false;
  if (p.stock <= 0 || !p.brandName || p.images.length === 0) return false;
  if (!p.ean || !isValidEan(p.ean)) return false;
  if (p.description.length < 80) return false;
  if (/zdarma|sleva|akce/i.test(p.name)) return false;
  return (
    p.code.startsWith("GVS-") ||
    p.code.startsWith("PAL-") ||
    ARABIC_PERFUME_BRANDS.has(p.brandName.toLowerCase())
  );
}
