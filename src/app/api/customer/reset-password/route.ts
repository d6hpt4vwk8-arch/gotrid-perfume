import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resetPasswordSchema } from "@/lib/customer/schemas";
import { consumePasswordResetToken } from "@/lib/customer/password-reset";
import { hashPassword } from "@/lib/customer/password";
import { CUSTOMER_COOKIE_NAME, createCustomerSessionToken } from "@/lib/customer/session";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const key = `reset-password:${ip}`;

  if (await isRateLimited(key, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json(
      { error: "Příliš mnoho pokusů. Zkuste to prosím později." },
      { status: 429 },
    );
  }

  const parsed = resetPasswordSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatná data." },
      { status: 400 },
    );
  }

  const customerId = await consumePasswordResetToken(parsed.data.token);
  if (!customerId) {
    await recordRateLimitHit(key);
    return NextResponse.json(
      { error: "Odkaz pro obnovení hesla je neplatný nebo vypršel. Zkuste si o něj požádat znovu." },
      { status: 400 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const customer = await prisma.customer.update({
    where: { id: customerId },
    data: { passwordHash },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(CUSTOMER_COOKIE_NAME, await createCustomerSessionToken(customer.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
