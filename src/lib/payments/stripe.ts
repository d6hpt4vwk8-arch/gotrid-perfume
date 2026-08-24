import Stripe from "stripe";

let client: Stripe | null = null;

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY není nastaven — platba kartou zatím není dostupná.");
  }
  if (!client) {
    client = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return client;
}

export async function createCheckoutSession({
  orderNumber,
  orderId,
  amountCzk,
  customerEmail,
  successUrl,
  cancelUrl,
}: {
  orderNumber: string;
  orderId: string;
  amountCzk: number;
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripeClient();

  return stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: customerEmail,
    client_reference_id: orderId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    // Stripe's own default is 24h — far longer than a card payment ever
    // legitimately takes, and long enough that an abandoned/failed checkout
    // sits as a plain "NEW" order (stock already reserved, see create-order.ts)
    // indistinguishable from a real COD/bank-transfer order for most of a
    // business day. Shortened to 2h so the checkout.session.expired webhook
    // (src/app/api/webhooks/stripe/route.ts) cancels it and releases stock
    // promptly, while still giving a genuine slow payment attempt room.
    expires_at: Math.floor(Date.now() / 1000) + 2 * 60 * 60,
    line_items: [
      {
        price_data: {
          currency: "czk",
          unit_amount: Math.round(amountCzk * 100),
          product_data: { name: `Objednávka ${orderNumber} — Gotrid Perfume` },
        },
        quantity: 1,
      },
    ],
    metadata: { orderId, orderNumber },
  });
}
