import { NextRequest, NextResponse } from "next/server";
import { runSecondOrderCampaign } from "@/lib/marketing/second-order-campaign";

// Triggered by Vercel Cron (see vercel.json) — same auth pattern as
// src/app/api/cron/sync-spventure-stock/route.ts.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  }

  const result = await runSecondOrderCampaign();
  return NextResponse.json(result);
}
