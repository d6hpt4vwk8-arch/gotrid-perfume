import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { isConditionFlagged } from "@/lib/feeds/condition-flagged";
import { isPaidAdsEligible } from "@/lib/feeds/paid-ads-eligibility";
import { buildGoogleShoppingRss } from "@/lib/feeds/google-shopping-rss";

// Rendered per-request rather than ISR-cached — see feeds/heureka.xml/route.ts
// for why (oversized-ISR-page build failure past ~15k products).
export const dynamic = "force-dynamic";

// Meta Commerce Manager (Advantage+ Shopping, TZ §7.4) accepts the same
// Google Shopping RSS schema — kept as a separate URL so it can be swapped
// for a Meta-specific format later without touching the Google feed.
export async function GET() {
  const allProducts = await getFeedProducts();
  // Same counterfeit-policy exposure as Google's feed — see
  // condition-flagged.ts and paid-ads-eligibility.ts's 2026-09-17 note.
  const products = allProducts.filter(
    (p) => !isConditionFlagged(p.name, p.isDefective) && isPaidAdsEligible(p.code, p.brandName),
  );
  const xml = buildGoogleShoppingRss(products);

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
