import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ORDER_ACCESS_COOKIE_NAME } from "@/lib/orders/verify-access";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24; // 24h — matches the email/receipt link's realistic reuse window

/**
 * One-time exchange for the bearer token in order confirmation links
 * (email, Stripe successUrl, post-checkout redirect): trades `?token=` for
 * an HttpOnly cookie, then 303s to the clean order URL. Keeps the token out
 * of browser history, referrer headers, and analytics/access logs — see the
 * security audit finding this closes (order accessToken in URL).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ number: string }> },
) {
  const { number } = await params;
  const token = req.nextUrl.searchParams.get("token");
  const destination = new URL(`/objednavka/${number}`, req.nextUrl.origin);

  if (!token) {
    return NextResponse.redirect(destination, { status: 303 });
  }

  const order = await prisma.order.findUnique({
    where: { number },
    select: { accessToken: true },
  });

  const response = NextResponse.redirect(destination, { status: 303 });
  if (order && order.accessToken === token) {
    response.cookies.set(ORDER_ACCESS_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
    });
  }
  return response;
}
