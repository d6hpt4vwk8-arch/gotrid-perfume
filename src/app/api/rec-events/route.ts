import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

// Anonymous counters for the cross-sell blocks (see RecommendationEvent in schema.prisma).
// Nothing identifying is stored — not even the IP, which is used only for the rate limit.
const BLOCKS = new Set(["pdp_related", "pdp_fbt", "pdp_complement", "pdp_line", "cart_complete"]);
const EVENTS = new Set(["view", "click", "add"]);
const ID_PATTERN = /^[A-Za-z0-9_-]{8,40}$/;
const MAX_ATTEMPTS = 120;
const WINDOW_MS = 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (await isRateLimited(`rec:${ip}`, MAX_ATTEMPTS, WINDOW_MS)) return new NextResponse(null, { status: 429 });

  let body: { block?: unknown; event?: unknown; productId?: unknown; sourceProductId?: unknown; locale?: unknown };
  try {
    body = await req.json();
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  const { block, event, productId, sourceProductId, locale } = body;
  if (typeof block !== "string" || !BLOCKS.has(block) || typeof event !== "string" || !EVENTS.has(event)) {
    return new NextResponse(null, { status: 400 });
  }
  const cleanId = (v: unknown) => (typeof v === "string" && ID_PATTERN.test(v) ? v : null);

  await recordRateLimitHit(`rec:${ip}`);
  try {
    await prisma.recommendationEvent.create({
      data: {
        block,
        event,
        productId: cleanId(productId),
        sourceProductId: cleanId(sourceProductId),
        locale: locale === "sk" ? "sk" : "cs",
      },
    });
  } catch {
    // best-effort analytics (also covers the table not being migrated yet) — never worth failing a page for
  }
  return new NextResponse(null, { status: 204 });
}
