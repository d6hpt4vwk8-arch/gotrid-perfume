import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/prisma";
import { sendMetaCapiEvent } from "@/lib/analytics/meta-capi";
import { sendZboziConversion } from "@/lib/analytics/zbozi-conversion";
import { sendHeurekaOrderLog } from "@/lib/analytics/heureka-overeno";
import { awardPointsForOrder } from "@/lib/loyalty";
import { resolveItemCodes, toItemId } from "@/lib/analytics/resolve-item-ids";
import { SITE_URL } from "@/lib/site";

// Stripe requires the raw request body to verify the webhook signature —
// Next's default JSON body parsing would corrupt it, so this route is opted
// out of the app-router's implicit parsing via the raw text read below.
export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe webhook not configured." }, { status: 400 });
  }

  const rawBody = await req.text();
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      const order = await prisma.order.update({
        where: { id: orderId },
        data: { status: "PAID" },
        include: { items: true },
      });

      if (order.marketingConsent) {
        const itemInputs = order.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          ean: i.ean,
          qty: i.qty,
          unitPrice: Number(i.unitPrice),
        }));

        void (async () => {
          // Meta's catalog keys products by `code`, not the internal
          // productId OrderItem stores — see client-events.ts.
          const codeByProductId = await resolveItemCodes(itemInputs);
          await sendMetaCapiEvent({
            eventName: "Purchase",
            eventId: order.number,
            eventSourceUrl: `${SITE_URL}/objednavka/${order.number}`,
            user: { email: order.email },
            customData: {
              currency: "CZK",
              value: Number(order.total),
              content_ids: itemInputs.map((i) => toItemId(i, codeByProductId)),
              num_items: order.items.reduce((sum, i) => sum + i.qty, 0),
            },
          });
        })().catch((err) =>
          console.error(`[meta-capi] purchase event failed for ${order.number}`, err),
        );

        void sendZboziConversion({
          orderId: order.number,
          items: itemInputs,
          deliveryType: order.shippingMethod,
          deliveryPrice: Number(order.shippingPrice),
          otherCosts: Number(order.discountAmount) > 0 ? -Number(order.discountAmount) : undefined,
          paymentType: order.paymentMethod,
        }).catch((err) => console.error(`[zbozi-conversion] failed for ${order.number}`, err));
      }

      // Heureka's satisfaction survey isn't ad tracking — it's a service
      // request about the order the customer just paid for (legal basis:
      // §7 odst. 3 zákona č. 480/2004 Sb., the "existing customer" soft
      // opt-in Heureka's whole program relies on) — so unlike Meta/Zboží
      // above, it doesn't wait on marketing-cookie consent.
      void sendHeurekaOrderLog({
        orderId: order.number,
        email: order.email,
        items: order.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          ean: i.ean,
          qty: i.qty,
          unitPrice: Number(i.unitPrice),
        })),
      }).catch((err) => console.error(`[heureka-overeno] failed for ${order.number}`, err));

      void awardPointsForOrder(order.id).catch((err) =>
        console.error(`[loyalty] award failed for ${order.number}`, err),
      );
    }
  }

  // Card orders decrement stock at creation, before payment — if the
  // customer never pays (session times out, ~24h by default), that stock
  // was reserved forever with nothing to release it (security audit
  // finding: stock committed before a successful charge). Restoring it here
  // only if the order is still NEW makes this safe against Stripe's webhook
  // retries: a second delivery of the same event finds status already
  // CANCELLED and no-ops.
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      await prisma.$transaction(async (tx) => {
        const claimed = await tx.order.updateMany({
          where: { id: orderId, status: "NEW" },
          data: { status: "CANCELLED" },
        });
        if (claimed.count === 0) return;

        const items = await tx.orderItem.findMany({ where: { orderId } });
        for (const item of items) {
          if (!item.productId) continue; // product was deleted since the order was placed
          await tx.product.updateMany({
            where: { id: item.productId },
            data: { stock: { increment: item.qty } },
          });
        }
      });
    }
  }

  return NextResponse.json({ received: true });
}
