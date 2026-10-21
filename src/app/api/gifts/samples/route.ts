import { NextResponse } from "next/server";
import { getGiftTriggersForProducts, getSampleGiftOptions } from "@/lib/gifts.server";

/**
 * Sample gifts the current cart qualifies for (K-beauty / Arabic perfume in the
 * cart) — see sample-gifts.ts. The cart lives in the browser, so it posts its
 * product ids; the order itself is re-validated server-side in createOrder().
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { productIds?: unknown };
  const productIds = Array.isArray(body.productIds)
    ? body.productIds.filter((x): x is string => typeof x === "string").slice(0, 100)
    : [];
  const triggers = await getGiftTriggersForProducts(productIds);
  const gifts = await getSampleGiftOptions(triggers);
  return NextResponse.json({ gifts });
}
