import { NextResponse } from "next/server";
import { getFeedProducts } from "@/lib/feeds/get-feed-products";
import { buildGoogleShoppingRss } from "@/lib/feeds/google-shopping-rss";

export const revalidate = 3600;

export async function GET() {
  const products = await getFeedProducts();
  const xml = buildGoogleShoppingRss(products);

  return new NextResponse(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
