import { NextRequest, NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/orders/checkout-schema";
import { CheckoutError, createOrder } from "@/lib/orders/create-order";
import { isStripeConfigured, createCheckoutSession } from "@/lib/payments/stripe";
import {
  sendCustomerOrderConfirmation,
  sendOwnerNewOrderNotification,
} from "@/lib/email/send-order-emails";
import { sendMetaCapiEvent } from "@/lib/analytics/meta-capi";
import { SITE_URL } from "@/lib/site";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";
import { getCurrentCustomerId } from "@/lib/customer/get-current-customer";

// Rate-limited on successful orders, not validation failures — a customer
// fixing a typo'd postcode shouldn't burn through the same budget as a
// script trying to grief stock via unpaid COD/bank-transfer orders.
const MAX_ORDERS = 8;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rateLimitKey = `checkout:${ip}`;

  if (await isRateLimited(rateLimitKey, MAX_ORDERS, WINDOW_MS)) {
    return NextResponse.json(
      { error: "Příliš mnoho objednávek za krátkou dobu. Zkuste to prosím později, nebo nás kontaktujte." },
      { status: 429 },
    );
  }

  const body = await req.json();
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatná data objednávky." },
      { status: 400 },
    );
  }

  if (parsed.data.paymentMethod === "CARD" && !isStripeConfigured()) {
    return NextResponse.json(
      { error: "Platba kartou momentálně není dostupná, zvolte prosím jinou metodu platby." },
      { status: 400 },
    );
  }

  let order;
  try {
    const customerId = await getCurrentCustomerId();
    order = await createOrder(parsed.data, customerId);
  } catch (err) {
    if (err instanceof CheckoutError) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }
    throw err;
  }
  await recordRateLimitHit(rateLimitKey);

  // Best-effort — a failed email must not roll back a paid/created order.
  void sendCustomerOrderConfirmation(order).catch((err) =>
    console.error(`[email] customer confirmation failed for ${order.number}`, err),
  );
  void sendOwnerNewOrderNotification(order).catch((err) =>
    console.error(`[email] owner notification failed for ${order.number}`, err),
  );

  if (order.paymentMethod === "CARD") {
    const origin = req.nextUrl.origin;
    const session = await createCheckoutSession({
      orderNumber: order.number,
      orderId: order.id,
      amountCzk: Number(order.total),
      customerEmail: order.email,
      // Routes through the access-exchange endpoint so the token becomes an
      // HttpOnly cookie instead of landing in Stripe's own redirect/logs.
      successUrl: `${origin}/api/orders/${order.number}/access?token=${order.accessToken}`,
      cancelUrl: `${origin}/kosik`,
    });
    // Purchase fires from the Stripe webhook instead — card orders aren't
    // paid yet at this point, only once checkout.session.completed arrives.
    return NextResponse.json({
      orderNumber: order.number,
      accessToken: order.accessToken,
      redirectUrl: session.url,
    });
  }

  // Bank transfer / cash on delivery convert at order placement itself,
  // there's no separate payment-gateway confirmation step to wait for.
  if (!order.marketingConsent) {
    return NextResponse.json({ orderNumber: order.number, accessToken: order.accessToken });
  }

  void sendMetaCapiEvent({
    eventName: "Purchase",
    eventId: order.number,
    eventSourceUrl: `${SITE_URL}/objednavka/${order.number}`,
    user: {
      email: order.email,
      clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
    customData: {
      currency: "CZK",
      value: Number(order.total),
      content_ids: order.items.map((i) => i.productId).filter(Boolean),
      num_items: order.items.reduce((sum, i) => sum + i.qty, 0),
    },
  }).catch((err) => console.error(`[meta-capi] purchase event failed for ${order.number}`, err));

  return NextResponse.json({ orderNumber: order.number, accessToken: order.accessToken });
}
