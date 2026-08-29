import { resolveItemCodes, toItemId, type OrderItemInput } from "./resolve-item-ids";

// Zboží.cz's own backend conversion API (github.com/seznam/zbozi-konverze),
// separate from — but reported alongside — the client-side rc.conversionHit
// tag fired in src/components/sklik-conversion.tsx. No signature scheme:
// the secret key is sent as a plain JSON field directly to Zboží's server,
// never exposed to the browser.
// Shop ID is public info (shown unmasked in Zboží.cz's own seller dashboard),
// so reusing the NEXT_PUBLIC_ var server-side here is safe — there's no
// separate server-only ZBOZI_SHOP_ID and never was one in .env, which is
// why this was silently no-op-ing (isZboziConversionConfigured() always
// false) since the integration was added.
const SHOP_ID = process.env.NEXT_PUBLIC_ZBOZI_SHOP_ID;
const SECRET_KEY = process.env.ZBOZI_SECRET_KEY;

export function isZboziConversionConfigured(): boolean {
  return Boolean(SHOP_ID && SECRET_KEY);
}

export interface ZboziConversionEvent {
  orderId: string;
  items: OrderItemInput[];
  deliveryType?: string;
  deliveryPrice?: number;
  otherCosts?: number;
  paymentType?: string;
}

export async function sendZboziConversion(event: ZboziConversionEvent): Promise<void> {
  if (!isZboziConversionConfigured()) {
    console.warn(`[zbozi-conversion] not configured — skipping order ${event.orderId}`);
    return;
  }

  const codeByProductId = await resolveItemCodes(event.items);
  const cart = event.items.map((item) => ({
    itemId: toItemId(item, codeByProductId),
    productName: item.name,
    unitPrice: item.unitPrice,
    quantity: item.qty,
  }));

  // Deliberately no "email" field here — Zboží.cz uses it to trigger their
  // own purchase-satisfaction survey email, which would double up with
  // Heureka's "Ověřeno zákazníky" dotazník (src/lib/analytics/heureka-overeno.ts)
  // for the same order. Revenue/conversion attribution below doesn't need it.
  const payload = {
    PRIVATE_KEY: SECRET_KEY,
    sandbox: false,
    orderId: event.orderId,
    cart,
    ...(event.deliveryType && { deliveryType: event.deliveryType }),
    ...(event.deliveryPrice !== undefined && { deliveryPrice: event.deliveryPrice }),
    ...(event.otherCosts !== undefined && { otherCosts: event.otherCosts }),
    ...(event.paymentType && { paymentType: event.paymentType }),
  };

  const res = await fetch(`https://www.zbozi.cz/action/${SHOP_ID}/conversion/backend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    console.error(`[zbozi-conversion] failed for order ${event.orderId}: ${res.status} ${await res.text()}`);
  }
}
