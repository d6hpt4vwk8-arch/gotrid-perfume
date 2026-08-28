import { NextRequest, NextResponse } from "next/server";
import { runSecondOrderCampaign } from "@/lib/marketing/second-order-campaign";
import { runAbandonedCheckoutRecovery } from "@/lib/marketing/abandoned-checkout";
import { syncPacketaDeliveryStatus } from "@/lib/orders/sync-packeta-delivery";
import { syncPerfumesWholesaleStock } from "@/lib/sync/perfumeswholesale-stock";

// Triggered by Vercel Cron (see vercel.json) — same auth pattern as
// src/app/api/cron/sync-spventure-stock/route.ts. Bundles the daily
// marketing + order-maintenance jobs into one cron entry (Vercel's Hobby
// plan caps the number of cron jobs, so new daily tasks should be added
// here rather than as separate cron entries).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  }

  const [secondOrder, abandonedCheckout, delivery, perfumesWholesaleStock] = await Promise.all([
    runSecondOrderCampaign(),
    runAbandonedCheckoutRecovery(),
    syncPacketaDeliveryStatus(),
    syncPerfumesWholesaleStock(),
  ]);

  return NextResponse.json({ secondOrder, abandonedCheckout, delivery, perfumesWholesaleStock });
}
