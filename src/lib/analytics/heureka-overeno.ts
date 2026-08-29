import { resolveItemCodes, toItemId, type OrderItemInput } from "./resolve-item-ids";

// Heureka's "Ověřeno zákazníky" (Verified by Customers) order-report API —
// completely separate from the client-side OCM conversion-measurement
// snippet in src/lib/heureka-conversion.ts (which never carries the
// customer's email and therefore can't trigger anything on its own).
// Without this call, Heureka never learns who to email, so the day-6
// satisfaction survey ("dotazník") never goes out and the shop's review
// count on Heureka never grows — this was the missing piece.
// Spec: github.com/heureka/overeno-zakazniky/blob/master/docs/api-documentation-cs.md
const API_KEY = process.env.HEUREKA_OVERENO_API_KEY;
const API_URL = "https://api.heureka.cz/shop-certification/v2/order/log";

export function isHeurekaOverenoConfigured(): boolean {
  return Boolean(API_KEY);
}

export interface HeurekaOrderLogEvent {
  orderId: string;
  email: string;
  items: OrderItemInput[];
}

export async function sendHeurekaOrderLog(event: HeurekaOrderLogEvent): Promise<void> {
  if (!isHeurekaOverenoConfigured()) {
    console.warn(`[heureka-overeno] not configured — skipping order ${event.orderId}`);
    return;
  }

  const codeByProductId = await resolveItemCodes(event.items);
  const productItemIds = event.items.map((item) => toItemId(item, codeByProductId));

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json;charset=utf-8" },
    body: JSON.stringify({
      apiKey: API_KEY,
      email: event.email,
      orderId: event.orderId,
      productItemIds,
    }),
  });

  if (!res.ok) {
    console.error(`[heureka-overeno] order/log failed for ${event.orderId}: ${res.status} ${await res.text()}`);
  }
}
