import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ORDER_ACCESS_COOKIE_NAME } from "@/lib/orders/verify-access";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;

/**
 * Where Comgate sends the customer after paying (url_paid) or when the payment is still pending (url_pending):
 * `?id=<transId>&refId=<order number>`. Both must match the order, which proves the visitor really came from that
 * payment, so we can hand over the same HttpOnly access cookie the order-confirmation link uses and show the order page.
 * (The order itself is confirmed by the webhook, not by this redirect.)
 */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const refId = req.nextUrl.searchParams.get("refId");
  const order =
    id && refId
      ? await prisma.order.findUnique({
          where: { comgateTransId: id },
          select: { number: true, accessToken: true, shippingCountry: true },
        })
      : null;

  if (!order || order.number !== refId) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin), { status: 303 });
  }

  const prefix = order.shippingCountry === "SK" ? "/sk" : "";
  const response = NextResponse.redirect(new URL(`${prefix}/objednavka/${order.number}`, req.nextUrl.origin), { status: 303 });
  response.cookies.set(ORDER_ACCESS_COOKIE_NAME, order.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
  return response;
}
