import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { buildGoogleShoppingRss } from "@/lib/feeds/google-shopping-rss";

// Rendered per-request rather than ISR-cached — see feeds/heureka.xml/route.ts
// for why (oversized-ISR-page build failure past ~15k products).
export const dynamic = "force-dynamic";

// Meta Commerce Manager (Advantage+ Shopping, TZ §7.4) accepts the same
// Google Shopping RSS schema — kept as a separate URL so it can be swapped
// for a Meta-specific format later without touching the Google feed.
export async function GET() {
  const products = await getFeedProducts();
  const xml = buildGoogleShoppingRss(products);

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
