import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendMetaCapiEvent } from "@/lib/analytics/meta-capi";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

// This endpoint is unauthenticated (fired from every product page view /
// add-to-cart) — a strict schema + same-origin check + rate limit keep it
// from being used to pad someone else's site's conversion data into our
// Pixel/CAPI account, or to spam Meta's API through us (security audit
// finding: public CAPI relay without a limit or a strict schema).
const MAX_REQUESTS = 60;
const WINDOW_MS = 5 * 60 * 1000;

const customDataSchema = z
  .object({
    currency: z.string().max(10).optional(),
    value: z.number().finite().min(0).max(10_000_000).optional(),
    content_ids: z.array(z.string().max(200)).max(50).optional(),
    content_name: z.string().max(300).optional(),
    content_type: z.string().max(50).optional(),
    num_items: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();

const bodySchema = z.object({
  eventName: z.enum(["ViewContent", "AddToCart"]),
  eventId: z.string().min(1).max(200),
  eventSourceUrl: z.string().url(),
  customData: customDataSchema.optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(`capi:${ip}`, MAX_REQUESTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { eventName, eventId, eventSourceUrl, customData } = parsed.data;

  if (new URL(eventSourceUrl).origin !== req.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  await recordRateLimitHit(`capi:${ip}`);

  await sendMetaCapiEvent({
    eventName,
    eventId,
    eventSourceUrl,
    user: {
      clientIp: ip !== "unknown" ? ip : undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
    customData,
  });

  return NextResponse.json({ ok: true });
}
