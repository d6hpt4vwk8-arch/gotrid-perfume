import { NextResponse } from "next/server";
import { getGiftOptions } from "@/lib/gifts.server";
import { getSettings } from "@/lib/settings.server";

/**
 * Gift picker data for the cart and checkout (both client components) — the
 * threshold ships alongside the options so the picker can show "do dárku
 * zbývá X Kč" without a second round trip.
 */
export async function GET() {
  const [settings, gifts] = await Promise.all([getSettings(), getGiftOptions()]);
  return NextResponse.json({ threshold: settings.giftThreshold, gifts });
}
