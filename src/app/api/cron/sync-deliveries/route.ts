import { NextRequest, NextResponse } from "next/server";
import { syncPacketaDeliveryStatus } from "@/lib/orders/sync-packeta-delivery";
import { syncGlsDeliveryStatus } from "@/lib/orders/sync-gls-delivery";

// Carrier delivery sync, run every two hours in the working day (see vercel.json) so the admin shows "Doručeno" the
// same day instead of the next morning. The daily-tasks cron still runs the same two syncs once a day as a safety net.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  }
  const [packeta, gls] = await Promise.all([syncPacketaDeliveryStatus(), syncGlsDeliveryStatus()]);
  return NextResponse.json({ packeta, gls });
}
