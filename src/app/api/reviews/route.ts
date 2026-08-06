import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  productId: z.string().min(1),
  rating: z.coerce.number().int().min(1, "Hodnocení musí být 1–5.").max(5, "Hodnocení musí být 1–5."),
  authorName: z.string().trim().max(100).optional(),
  text: z.string().trim().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const key = `review-submit:${ip}`;

  if (await isRateLimited(key, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json(
      { error: "Příliš mnoho recenzí odesláno, zkuste to prosím později." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatná data recenze." },
      { status: 400 },
    );
  }

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product) {
    return NextResponse.json({ error: "Produkt nenalezen." }, { status: 404 });
  }

  await recordRateLimitHit(key);

  await prisma.review.create({
    data: {
      productId: parsed.data.productId,
      rating: parsed.data.rating,
      authorName: parsed.data.authorName || null,
      text: parsed.data.text || null,
      published: false,
    },
  });

  return NextResponse.json({ ok: true });
}
