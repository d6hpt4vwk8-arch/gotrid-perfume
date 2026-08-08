import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { previewCoupon } from "@/lib/coupons";
import { CheckoutError } from "@/lib/orders/checkout-error";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  code: z.string().trim().min(1).max(50),
  itemsTotal: z.coerce.number().min(0).max(10_000_000),
});

const MAX_ATTEMPTS = 20;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimitKey = `coupon:${ip}`;

  if (await isRateLimited(rateLimitKey, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Příliš mnoho pokusů, zkuste to prosím později." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  await recordRateLimitHit(rateLimitKey);

  try {
    const result = await previewCoupon(parsed.data.code, parsed.data.itemsTotal);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
