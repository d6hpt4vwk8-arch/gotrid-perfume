import { NextRequest, NextResponse } from "next/server";
import { syncBankPayments } from "@/lib/orders/sync-bank-payments";

// Air Bank payment notifications → order status, every 15 minutes (see vercel.json). Reads the banka@ mailbox over IMAP
// and marks matching BANK_TRANSFER orders paid; does nothing until BANK_IMAP_USER / BANK_IMAP_PASSWORD are set.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  }
  return NextResponse.json(await syncBankPayments());
}
