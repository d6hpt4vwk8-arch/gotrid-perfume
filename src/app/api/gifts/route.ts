import { NextRequest, NextResponse } from "next/server";
import { getGiftOptionForProduct, getGiftOptions } from "@/lib/gifts.server";

/**
 * Gift picker data for the cart and checkout (both client components).
 * Whether the picker is actually shown is gated by a GIFT-type coupon being
 * applied (see CouponField/GiftPicker) — this endpoint just lists what's on
 * offer. With ?productId= it returns only that product (a loyalty-reward gift
 * coupon is for one specific product); the order itself re-checks it server-side.
 */
export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId");
  if (productId) {
    const gift = await getGiftOptionForProduct(productId);
    return NextResponse.json({ gifts: gift ? [gift] : [] });
  }
  const gifts = await getGiftOptions();
  return NextResponse.json({ gifts });
}
