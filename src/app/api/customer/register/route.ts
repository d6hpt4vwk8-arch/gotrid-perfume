import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/customer/schemas";
import { hashPassword } from "@/lib/customer/password";
import { CUSTOMER_COOKIE_NAME, createCustomerSessionToken } from "@/lib/customer/session";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const key = `customer-register:${ip}`;

  if (await isRateLimited(key, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json(
      { error: "Příliš mnoho pokusů o registraci. Zkuste to prosím později." },
      { status: 429 },
    );
  }

  const parsed = registerSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatná data." },
      { status: 400 },
    );
  }

  await recordRateLimitHit(key);

  const existing = await prisma.customer.findUnique({ where: { email: parsed.data.email } });
  if (existing) {
    return NextResponse.json(
      { error: "Účet s tímto e-mailem už existuje. Zkuste se přihlásit." },
      { status: 409 },
    );
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const customer = await prisma.customer.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
    },
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(
    CUSTOMER_COOKIE_NAME,
    await createCustomerSessionToken(customer.id, customer.sessionVersion),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    },
  );
  return res;
}
