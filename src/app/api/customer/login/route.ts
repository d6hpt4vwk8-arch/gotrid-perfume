import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/customer/schemas";
import { verifyPassword } from "@/lib/customer/password";
import { CUSTOMER_COOKIE_NAME, createCustomerSessionToken } from "@/lib/customer/session";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const key = `customer-login:${ip}`;

  if (await isRateLimited(key, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json(
      { error: "Příliš mnoho pokusů o přihlášení. Zkuste to prosím za 15 minut." },
      { status: 429 },
    );
  }

  const parsed = loginSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatná data." },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.findUnique({ where: { email: parsed.data.email } });
  const passwordOk =
    customer?.passwordHash && (await verifyPassword(parsed.data.password, customer.passwordHash));

  if (!customer || !passwordOk) {
    await recordRateLimitHit(key);
    return NextResponse.json({ error: "Nesprávný e-mail nebo heslo." }, { status: 401 });
  }

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
