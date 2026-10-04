import { NextRequest, NextResponse } from "next/server";
import { runSecondOrderCampaign, cleanupExpiredSecondOrderCoupons } from "@/lib/marketing/second-order-campaign";
import { runReviewRequestCampaign } from "@/lib/marketing/review-request-campaign";
import { runAbandonedCheckoutRecovery } from "@/lib/marketing/abandoned-checkout";
import { syncPacketaDeliveryStatus } from "@/lib/orders/sync-packeta-delivery";
import { syncGlsDeliveryStatus } from "@/lib/orders/sync-gls-delivery";
import { checkZasilkovnaVolumeMilestone } from "@/lib/marketing/zasilkovna-volume-check.server";
import { expireInactiveLoyaltyPoints } from "@/lib/loyalty";

// Triggered by Vercel Cron (see vercel.json) — same auth pattern as
// src/app/api/cron/sync-spventure-stock/route.ts. Bundles the daily
// marketing + order-maintenance jobs into one cron entry (Vercel's Hobby
// plan caps the number of cron jobs, so new daily tasks should be added
// here rather than as separate cron entries).
//
// syncPerfumesWholesaleStock is deliberately NOT called below (2026-09-27,
// owner request) — PWH isn't an active supplier right now, so syncing its
// ~10k-SKU stock daily is pure wasted load. Re-add it to the Promise.all
// below (and the import above) if PWH sourcing resumes; when it ran, it
// wrote one row at a time for every changed product (thousands on a normal
// day) — without a generous timeout the route silently died past the
// platform's default ~10-15s function timeout on any day with an unusually
// large stock delta, with no error logged (the invocation is just killed),
// and a missed day made the next day's delta bigger, compounding until it
// stopped completing at all (confirmed: no perfumeswholesale_sync
// activity-log entries 2026-08-29 through 2026-09-02, while the separate SP
// Venture cron kept succeeding daily in the same window).
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  }

  // syncFioPayments is deliberately not called here: BANK_IBAN moved to the
  // Gotrid s.r.o. Air Bank account (2026-09-22, entity switch), so incoming
  // transfers no longer land in the Fio account this job reads. Fio has no
  // equivalent auto-confirmation until an Air Bank statement integration is
  // built (their transaction API needs a ČNB-licensed AISP aggregator, not a
  // simple token) — until then, BANK_TRANSFER orders are confirmed by hand.
  const [
    secondOrder,
    reviewRequest,
    abandonedCheckout,
    delivery,
    glsDelivery,
    zasilkovnaVolume,
    loyaltyExpiry,
    couponCleanup,
  ] = await Promise.all([
    runSecondOrderCampaign(),
    runReviewRequestCampaign(),
    runAbandonedCheckoutRecovery(),
    syncPacketaDeliveryStatus(),
    syncGlsDeliveryStatus(),
    checkZasilkovnaVolumeMilestone(),
    expireInactiveLoyaltyPoints(),
    cleanupExpiredSecondOrderCoupons(),
  ]);

  return NextResponse.json({
    secondOrder,
    reviewRequest,
    abandonedCheckout,
    delivery,
    glsDelivery,
    zasilkovnaVolume,
    loyaltyExpiry,
    couponCleanup,
  });
}
