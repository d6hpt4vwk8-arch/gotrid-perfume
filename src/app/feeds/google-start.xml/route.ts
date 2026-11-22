import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { isGoogleStartWave } from "@/lib/feeds/google-start-wave";
import { buildGoogleShoppingRss } from "@/lib/feeds/google-shopping-rss";

// Small, curated first-wave feed for the new Merchant Center account (see google-start-wave.ts). Rendered per request
// for the same reason as the other feeds (oversized ISR page past ~15k products).
export const dynamic = "force-dynamic";

export async function GET() {
  const products = (await getFeedProducts()).filter((p) => isGoogleStartWave(p));
  return new NextResponse(buildGoogleShoppingRss(products), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
