import { NextRequest, NextResponse } from "next/server";
import { runSecondOrderCampaign } from "@/lib/marketing/second-order-campaign";
import { runAbandonedCheckoutRecovery } from "@/lib/marketing/abandoned-checkout";
import { syncPacketaDeliveryStatus } from "@/lib/orders/sync-packeta-delivery";
import { syncPerfumesWholesaleStock } from "@/lib/sync/perfumeswholesale-stock";
import { checkZasilkovnaVolumeMilestone } from "@/lib/marketing/zasilkovna-volume-check.server";

// Triggered by Vercel Cron (see vercel.json) — same auth pattern as
// src/app/api/cron/sync-spventure-stock/route.ts. Bundles the daily
// marketing + order-maintenance jobs into one cron entry (Vercel's Hobby
// plan caps the number of cron jobs, so new daily tasks should be added
// here rather than as separate cron entries).
//
// syncPerfumesWholesaleStock writes one row at a time for every changed
// product (thousands on a normal day, its catalog is ~10k SKUs) — without
// this, the route silently died past the platform's default ~10-15s
// function timeout on any day with an unusually large stock delta, with no
// error logged (the invocation is just killed), and a missed day made the
// next day's delta bigger, compounding until it stopped completing at all
// (confirmed: no perfumeswholesale_sync activity-log entries 2026-08-29
// through 2026-09-02, while the separate SP Venture cron kept succeeding
// daily in the same window).
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  }

  const [secondOrder, abandonedCheckout, delivery, perfumesWholesaleStock, zasilkovnaVolume] = await Promise.all([
    runSecondOrderCampaign(),
    runAbandonedCheckoutRecovery(),
    syncPacketaDeliveryStatus(),
    syncPerfumesWholesaleStock(),
    checkZasilkovnaVolumeMilestone(),
  ]);

  return NextResponse.json({ secondOrder, abandonedCheckout, delivery, perfumesWholesaleStock, zasilkovnaVolume });
}
