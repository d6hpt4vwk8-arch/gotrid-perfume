import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

const bodySchema = z.object({
  productId: z.string().min(1).max(200),
  email: z.string().trim().max(320).email("Zadejte platný e-mail."),
});

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimitKey = `stock-alert:${ip}`;

  if (await isRateLimited(rateLimitKey, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json({ error: "Příliš mnoho pokusů, zkuste to prosím později." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatný požadavek." },
      { status: 400 },
    );
  }

  const product = await prisma.product.findUnique({ where: { id: parsed.data.productId } });
  if (!product) {
    return NextResponse.json({ error: "Produkt nenalezen." }, { status: 404 });
  }

  await recordRateLimitHit(rateLimitKey);

  const existing = await prisma.stockAlert.findFirst({
    where: { productId: parsed.data.productId, email: parsed.data.email, notified: false },
  });
  if (!existing) {
    await prisma.stockAlert.create({
      data: { productId: parsed.data.productId, email: parsed.data.email },
    });
  }

  return NextResponse.json({ ok: true });
}
