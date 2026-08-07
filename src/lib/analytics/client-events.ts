declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

function randomEventId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function relayToCapi(
  eventName: "ViewContent" | "AddToCart",
  eventId: string,
  customData: Record<string, unknown>,
) {
  try {
    await fetch("/api/analytics/capi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventName,
        eventId,
        eventSourceUrl: window.location.href,
        customData,
      }),
    });
  } catch {
    // best-effort — never block the UI on analytics delivery
  }
}

/** Fires a Pixel + server CAPI event pair sharing one event_id for Meta's deduplication. */
function trackEvent(eventName: "ViewContent" | "AddToCart", customData: Record<string, unknown>) {
  const eventId = randomEventId();
  window.fbq?.("track", eventName, customData, { eventID: eventId });
  void relayToCapi(eventName, eventId, customData);
}

export function trackViewContent(product: { id: string; name: string; price: number }) {
  trackEvent("ViewContent", {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    currency: "CZK",
    value: product.price,
  });
}

export function trackAddToCart(product: { id: string; name: string; price: number; qty: number }) {
  trackEvent("AddToCart", {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    currency: "CZK",
    value: product.price * product.qty,
  });
}
