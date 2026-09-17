import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkoutSchema } from "@/lib/orders/checkout-schema";
import { CheckoutError, createOrder } from "@/lib/orders/create-order";
import { isStripeConfigured, createCheckoutSession } from "@/lib/payments/stripe";
import {
  sendCustomerOrderConfirmation,
  sendOwnerNewOrderNotification,
} from "@/lib/email/send-order-emails";
import { sendMetaCapiEvent } from "@/lib/analytics/meta-capi";
import { sendZboziConversion } from "@/lib/analytics/zbozi-conversion";
import { resolveItemCodes, toItemId } from "@/lib/analytics/resolve-item-ids";
import { SITE_URL } from "@/lib/site";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";
import { getCurrentCustomerId } from "@/lib/customer/get-current-customer";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { getSettings } from "@/lib/settings.server";
import { czkToEur } from "@/lib/format";

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
  // Logged to AdminActivityLog (not just console.error) so a failure is
  // visible in /admin/email-marketing instead of only in Vercel function logs.
  void sendCustomerOrderConfirmation(order).catch((err) => {
    console.error(`[email] customer confirmation failed for ${order.number}`, err);
    void logAdminActivity({
      action: "order.confirmation_email_failed",
      entityType: "Order",
      entityId: order.id,
      detail: `${order.number}: ${err instanceof Error ? err.message : String(err)}`,
    });
  });
  void sendOwnerNewOrderNotification(order).catch((err) => {
    console.error(`[email] owner notification failed for ${order.number}`, err);
    void logAdminActivity({
      action: "order.owner_notification_email_failed",
      entityType: "Order",
      entityId: order.id,
      detail: `${order.number}: ${err instanceof Error ? err.message : String(err)}`,
    });
  });

  if (order.paymentMethod === "CARD") {
    const origin = req.nextUrl.origin;
    // Order.total is always CZK — a Slovak order is charged in EUR so the
    // card isn't hit with the bank's own conversion fee on top of ours.
    const settings = await getSettings();
    const isSk = order.shippingCountry === "SK";
    const amount = isSk ? czkToEur(order.total, settings.czkToEurRate) : Number(order.total);
    const currency = isSk ? "eur" : "czk";
    const session = await createCheckoutSession({
      orderNumber: order.number,
      orderId: order.id,
      amount,
      currency,
      customerEmail: order.email,
      // Routes through the access-exchange endpoint so the token becomes an
      // HttpOnly cookie instead of landing in Stripe's own redirect/logs.
      successUrl: `${origin}/api/orders/${order.number}/access?token=${order.accessToken}`,
      cancelUrl: `${origin}/kosik`,
    });
    if (isSk) {
      // createOrder() defaulted chargedCurrency/chargedAmount to CZK/total —
      // overwrite with what Stripe is actually charging, snapshotted now
      // rather than left to be recomputed later against a possibly-changed
      // Settings.czkToEurRate (see the field's comment in schema.prisma).
      await prisma.order.update({
        where: { id: order.id },
        data: { chargedCurrency: "EUR", chargedAmount: amount },
      });
    }
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

  void (async () => {
    // Meta's catalog keys products by `code` (see google-shopping-rss.ts's
    // <g:id>), not the internal productId OrderItem stores — resolving
    // through the same helper Heureka/Zboží already use for this so the
    // catalog can actually match this Purchase back to a product.
    const itemInputs = order.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      ean: i.ean,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
    }));
    const codeByProductId = await resolveItemCodes(itemInputs);
    await sendMetaCapiEvent({
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
        content_ids: itemInputs.map((i) => toItemId(i, codeByProductId)),
        num_items: order.items.reduce((sum, i) => sum + i.qty, 0),
      },
    });
  })().catch((err) => console.error(`[meta-capi] purchase event failed for ${order.number}`, err));

  void sendZboziConversion({
    orderId: order.number,
    items: order.items.map((i) => ({
      productId: i.productId,
      name: i.name,
      ean: i.ean,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
    })),
    deliveryType: order.shippingMethod,
    deliveryPrice: Number(order.shippingPrice),
    otherCosts: Number(order.discountAmount) > 0 ? -Number(order.discountAmount) : undefined,
    paymentType: order.paymentMethod,
  }).catch((err) => console.error(`[zbozi-conversion] failed for ${order.number}`, err));

  // Heureka's Ověřeno zákazníky report is sent once this order is actually
  // confirmed (leaves NEW in the admin, see updateOrderStatus) rather than
  // here at creation — a COD/bank-transfer order isn't a real sale yet at
  // this point (see canDownloadInvoice's reasoning in status-labels.ts), and
  // sending here meant a cancelled order still got a "rate your purchase"
  // request from Heureka.

  return NextResponse.json({ orderNumber: order.number, accessToken: order.accessToken });
}
