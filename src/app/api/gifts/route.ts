import { NextResponse } from "next/server";
import { getGiftOptions } from "@/lib/gifts.server";

/**
 * Gift picker data for the cart and checkout (both client components).
 * Whether the picker is actually shown is gated by a GIFT-type coupon being
 * applied (see CouponField/GiftPicker) — this endpoint just lists what's on
 * offer.
 */
export async function GET() {
  const gifts = await getGiftOptions();
  return NextResponse.json({ gifts });
}
