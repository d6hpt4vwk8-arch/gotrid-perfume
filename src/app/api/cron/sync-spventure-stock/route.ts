import { NextRequest, NextResponse } from "next/server";
import { syncSpVentureStock } from "@/lib/sync/spventure-stock";

// Triggered by Vercel Cron (see vercel.json). Vercel automatically sends
// `Authorization: Bearer $CRON_SECRET` on cron-triggered requests when
// CRON_SECRET is set as a project env var — this route rejects anything
// else so it can't be hit by a random request to run a real feed fetch +
// DB write.
//
// Explicit maxDuration — the update loop writes one row per changed
// product sequentially, and a large stock delta day could otherwise hit
// the platform's default function timeout with no error logged (see the
// same issue on perfumes-wholesale.eu's sync in daily-tasks/route.ts).
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  }

  const result = await syncSpVentureStock();
  return NextResponse.json(result);
}
