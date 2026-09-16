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
