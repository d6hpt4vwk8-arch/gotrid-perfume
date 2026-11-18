import { isConditionFlagged } from "./condition-flagged";
import { isPaidAdsEligible } from "./paid-ads-eligibility";

// Google/Meta-only exclusions on top of isPaidAdsEligible — these items
// stay eligible for Heureka/Zboží (a semi-clearance/dupe click there is
// still worth paying for, see paid-ads-eligibility.ts), but shouldn't
// represent us in Google's free listings or any future Ads/Merchant
// account: Eyfel's own perfumes are a recognizable dupe line best kept off
// Google specifically, and anything already marked down to Výprodej is, by
// definition, not the normal-price listing Google should be showing.
export function isExcludedFromGoogleAds(product: {
  brandName: string | null;
  isPerfume: boolean;
  isOnClearance: boolean;
}): boolean {
  if (!product.isPerfume) return false;
  if (product.brandName === "Eyfel Perfume") return true;
  if (product.isOnClearance) return true;
  return false;
}

// Cannabis/CBD names are a restricted category for Google Shopping and Meta (and the EU rules differ per
// country), so they stay out of both feeds. Plain hemp-seed cosmetics ("konopné semínko", "konopný balzám")
// are legal everyday products and are not matched — only an explicit CBD or cannabis in the name.
export function isHempRestricted(name: string): boolean {
  return /\bcbd\b|cannab|cannasex/i.test(name);
}

// One verdict for "may Google see this product": the Google feed and the product-page JSON-LD both use it.
// Merchant Center collects products on its own from the Product markup of any crawled page (it did on 2026-11-18,
// 929 products incl. designer perfumes), so a product the feed keeps out of Google must not carry Product markup
// either. The page itself stays visible and buyable for customers.
export function isGoogleListable(p: {
  code: string;
  name: string;
  isDefective: boolean;
  brandName: string | null;
  isPerfume: boolean;
  isOnClearance: boolean;
}): boolean {
  return (
    !isConditionFlagged(p.name, p.isDefective) &&
    isPaidAdsEligible(p.code, p.brandName) &&
    !isExcludedFromGoogleAds(p) &&
    !isHempRestricted(p.name)
  );
}
