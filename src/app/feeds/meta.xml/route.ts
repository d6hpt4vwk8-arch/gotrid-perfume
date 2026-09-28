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
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // force-dynamic (see comment above) skips Next's build-time cache, but
      // shopping-feed crawlers (Google, Heureka, Zboží, Glami, Meta) poll
      // these URLs many times a day — without this, every single hit was
      // re-querying the whole catalog and re-rendering the full XML from
      // scratch. s-maxage lets Vercel's edge cache the response for an hour;
      // stale-while-revalidate keeps serving that cached copy during the
      // background refresh instead of blocking a crawler on a cold render.
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
