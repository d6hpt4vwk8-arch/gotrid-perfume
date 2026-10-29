import { resolveItemCodes, toItemId, type OrderItemInput } from "./resolve-item-ids";

// Heureka's "Ověřeno zákazníky" (Verified by Customers) order-report API —
// completely separate from the client-side OCM conversion-measurement
// snippet in src/lib/heureka-conversion.ts (which never carries the
// customer's email and therefore can't trigger anything on its own).
// Without this call, Heureka never learns who to email, so the day-6
// satisfaction survey ("dotazník") never goes out and the shop's review
// count on Heureka never grows — this was the missing piece.
// Spec: github.com/heureka/overeno-zakazniky/blob/master/docs/api-documentation-cs.md
// Heureka.sk is a separate shop account: its own secret key and the .sk API host
// (https://github.com/heureka/overeno-zakazniky/blob/master/docs/api-documentation-cs.md — "API klíče jsou rozdílné pro českou a slovenskou Heureku").
const API_KEY = process.env.HEUREKA_OVERENO_API_KEY;
const API_KEY_SK = process.env.HEUREKA_SK_OVERENO_API_KEY;
const API_URL = "https://api.heureka.cz/shop-certification/v2/order/log";
const API_URL_SK = "https://api.heureka.sk/shop-certification/v2/order/log";

export function isHeurekaOverenoConfigured(country: string = "CZ"): boolean {
  return Boolean(country === "SK" ? API_KEY_SK : API_KEY);
}

export interface HeurekaOrderLogEvent {
  orderId: string;
  email: string;
  items: OrderItemInput[];
  /** Order's shipping country; Slovak orders are reported to Heureka.sk with its own key. Defaults to CZ. */
  country?: string;
}

export async function sendHeurekaOrderLog(event: HeurekaOrderLogEvent): Promise<void> {
  const country = event.country === "SK" ? "SK" : "CZ";
  // A Slovak order must never fall back to the Czech key: Heureka.cz would mail the buyer its Czech survey.
  if (!isHeurekaOverenoConfigured(country)) {
    console.warn(`[heureka-overeno] ${country} not configured — skipping order ${event.orderId}`);
    return;
  }

  const codeByProductId = await resolveItemCodes(event.items);
  const productItemIds = event.items.map((item) => toItemId(item, codeByProductId));

  const res = await fetch(country === "SK" ? API_URL_SK : API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=utf-8" },
    body: JSON.stringify({
      apiKey: country === "SK" ? API_KEY_SK : API_KEY,
      email: event.email,
      orderId: event.orderId,
      productItemIds,
    }),
  });

  if (!res.ok) {
    console.error(`[heureka-overeno] order/log failed for ${event.orderId}: ${res.status} ${await res.text()}`);
  }
}
