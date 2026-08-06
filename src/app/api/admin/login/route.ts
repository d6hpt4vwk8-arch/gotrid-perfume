import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, createSessionToken, verifyPassword } from "@/lib/admin-auth";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const key = `admin-login:${ip}`;

  if (await isRateLimited(key, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json(
      { error: "Příliš mnoho pokusů o přihlášení. Zkuste to prosím za 15 minut." },
      { status: 429 },
    );
  }

  const { password } = await req.json();

  if (typeof password !== "string" || !verifyPassword(password)) {
    await recordRateLimitHit(key);
    return NextResponse.json({ error: "Nesprávné heslo." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
