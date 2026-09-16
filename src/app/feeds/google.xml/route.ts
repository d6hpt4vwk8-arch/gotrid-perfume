import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { isConditionFlagged } from "@/lib/feeds/condition-flagged";
import { isPaidAdsEligible } from "@/lib/feeds/paid-ads-eligibility";
import { isExcludedFromGoogleAds } from "@/lib/feeds/google-exclusions";
import { buildGoogleShoppingRss } from "@/lib/feeds/google-shopping-rss";

// Rendered per-request rather than ISR-cached — see feeds/heureka.xml/route.ts
// for why (oversized-ISR-page build failure past ~15k products).
export const dynamic = "force-dynamic";

export async function GET() {
  const allProducts = await getFeedProducts();
  // Condition-flagged listings never go to Google — see condition-flagged.ts
  // for why (the counterfeit suspension that killed the previous store).
  // isPaidAdsEligible additionally keeps designer perfumes with no unique
  // description out of this feed too — see paid-ads-eligibility.ts's
  // 2026-09-17 note. isExcludedFromGoogleAds trims a couple more perfume
  // cases (Eyfel's own line, anything on Výprodej) that pass that filter
  // but still shouldn't represent us specifically on Google.
  const products = allProducts.filter(
    (p) =>
      !isConditionFlagged(p.name, p.isDefective) &&
      isPaidAdsEligible(p.code, p.brandName) &&
      !isExcludedFromGoogleAds(p),
  );
  const xml = buildGoogleShoppingRss(products);

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
