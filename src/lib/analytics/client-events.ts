declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    glami?: (...args: unknown[]) => void;
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

// GLAMI Pixel (glami.cz/info/pixel-implementace/) wants its own shape —
// item_ids as an array matching the feed's <ITEM_ID>, no content_name — so
// this can't just reuse customData from trackEvent above. Callers already
// gate on consent.marketing before calling trackViewContent/trackAddToCart
// (see product-view-tracker.tsx / add-to-cart-button.tsx), and GlamiPixel
// itself no-ops until that consent is granted, so no separate check needed
// here — window.glami is simply undefined until then.
function trackGlami(eventName: "ViewContent" | "AddToCart", data: Record<string, unknown>) {
  window.glami?.("track", eventName, { consent: 1, ...data });
}

export function trackViewContent(product: { id: string; name: string; price: number }) {
  trackEvent("ViewContent", {
    content_ids: [product.id],
    content_name: product.name,
    content_type: "product",
    currency: "CZK",
    value: product.price,
  });
  trackGlami("ViewContent", {
    content_type: "product",
    item_ids: [product.id],
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
  trackGlami("AddToCart", {
    item_ids: [product.id],
    currency: "CZK",
    value: product.price * product.qty,
  });
}
