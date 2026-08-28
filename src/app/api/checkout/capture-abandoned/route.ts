import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

// Fired (debounced) from the checkout form once a visitor has filled in
// contact details but not yet submitted the order — see
// src/components/checkout-form.tsx and src/lib/marketing/abandoned-checkout.ts.
const cartItemSchema = z.object({
  productId: z.string().min(1).max(200),
  slug: z.string().min(1).max(300),
  name: z.string().min(1).max(300),
  price: z.number().finite(),
  image: z.string().max(1000).nullable(),
  qty: z.number().int().min(1).max(1000),
  stock: z.number().int(),
});

const bodySchema = z.object({
  email: z.string().trim().max(320).email(),
  firstName: z.string().trim().max(200).optional(),
  phone: z.string().trim().max(50).optional(),
  cartSnapshot: z.array(cartItemSchema).min(1).max(100),
});

const MAX_ATTEMPTS = 30;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimitKey = `capture-abandoned:${ip}`;

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
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  await recordRateLimitHit(rateLimitKey);

  const { email, firstName, phone, cartSnapshot } = parsed.data;
  await prisma.abandonedCheckout.upsert({
    where: { email: email.toLowerCase() },
    update: { firstName, phone, cartSnapshot, capturedAt: new Date() },
    create: { email: email.toLowerCase(), firstName, phone, cartSnapshot },
  });

  return NextResponse.json({ ok: true });
}
