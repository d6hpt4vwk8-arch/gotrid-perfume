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
  amount,
  currency,
  customerEmail,
  successUrl,
  cancelUrl,
}: {
  orderNumber: string;
  orderId: string;
  // Already converted to the currency below — every DB price is CZK, but a
  // Slovak order is charged in EUR (see src/app/api/orders/route.ts) so its
  // card isn't hit with the bank's own conversion fee on top of ours.
  amount: number;
  currency: "czk" | "eur";
  customerEmail: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = getStripeClient();

  return stripe.checkout.sessions.create({
    mode: "payment",
    // Explicit, not left to Stripe's automatic per-session selection —
    // checkout-schema.ts only ever ships to CZ/SK, so nothing here should
    // ever need Bancontact/MB WAY/Satispay/Pix/BLIK/EPS/Klarna etc., which
    // the Dashboard has enabled for the separate, manually-created Payment
    // Links used for one-off wholesale sales abroad (e.g. a Belgian buyer
    // paying via Bancontact) — those aren't created through this function
    // and are unaffected by this restriction. Apple Pay, Google Pay and
    // Link still ride on top of "card" automatically and aren't listed here.
    payment_method_types: ["card"],
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
          currency,
          unit_amount: Math.round(amount * 100),
          product_data: { name: `Objednávka ${orderNumber} — Gotrid Perfume` },
        },
        quantity: 1,
      },
    ],
    metadata: { orderId, orderNumber },
  });
}
