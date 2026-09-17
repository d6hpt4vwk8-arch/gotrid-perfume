import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { previewLoyalty } from "@/lib/loyalty";
import { getSettings } from "@/lib/settings.server";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().trim().max(320).email(),
  itemsTotal: z.coerce.number().min(0).max(10_000_000),
});

// Same shape/limits as /api/coupons/validate — read-only balance lookup by
// email, no auth required (mirrors how a guest applies a coupon code
// without an account), rate-limited per IP against enumeration.
const MAX_ATTEMPTS = 20;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimitKey = `loyalty-preview:${ip}`;

  if (await isRateLimited(rateLimitKey, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Příliš mnoho pokusů, zkuste to prosím později." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  await recordRateLimitHit(rateLimitKey);

  const settings = await getSettings();
  const result = await previewLoyalty(parsed.data.email, parsed.data.itemsTotal, settings);
  return NextResponse.json(result);
}
