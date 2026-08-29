import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().trim().max(320).email(),
});

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimitKey = `newsletter-subscribe:${ip}`;

  if (await isRateLimited(rateLimitKey, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Příliš mnoho pokusů." }, { status: 429 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Zadejte prosím platný e-mail." }, { status: 400 });
  }

  await recordRateLimitHit(rateLimitKey);

  const email = parsed.data.email.toLowerCase();
  // Same upsert-by-email idiom as the checkout newsletter checkbox
  // (create-order.ts) — a guest signing up here who later checks out with
  // the same email lands on this same Customer row instead of a duplicate.
  await prisma.customer.upsert({
    where: { email },
    update: { marketingOptIn: true },
    create: { email, marketingOptIn: true },
  });

  return NextResponse.json({ ok: true });
}
