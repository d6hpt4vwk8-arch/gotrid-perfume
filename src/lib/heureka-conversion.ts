// Shared script loader for Heureka's conversion-measurement "OCM SDK"
// (sluzby.heureka.cz / sluzby.heureka.sk → Statistiky a reporty → Meranie konverzií). Heureka.cz and Heureka.sk are
// separate shop accounts: each has its own host (www.heureka.cz / www.heureka.sk), its own country flag (`heureka.c`)
// and its own conversion key, so a Slovak order must be reported to the .sk SDK, never to the .cz one.
// Two pages need it with a different `page=` query param — product detail
// (src/components/heureka-product-view.tsx, sets a cookie noting the
// visitor arrived via Heureka) and the order confirmation page
// (src/components/heureka-conversion.tsx, reports the actual sale). Both
// share the same `window.heureka` queue-stub, reproduced here exactly per
// Heureka's own snippet (including window.ROIDataObject) — the stub queues calls made before the real script
// finishes downloading, so callers don't need to wait for a load event.

declare global {
  interface Window {
    heureka?: ((...args: unknown[]) => void) & { q?: unknown[]; c?: string };
  }
}

export type HeurekaCountry = "cz" | "sk";

// Public by design: Heureka's own snippet embeds the key in every page's JavaScript.
export const HEUREKA_CONVERSION_KEYS: Record<HeurekaCountry, string | undefined> = {
  cz: process.env.NEXT_PUBLIC_HEUREKA_CONVERSION_KEY,
  sk: process.env.NEXT_PUBLIC_HEUREKA_SK_CONVERSION_KEY ?? "bccd9da18c9b0bb255e1dc4fd0610e144464",
};

const loadedPages = new Set<string>();

export function loadHeurekaScript(page: "product_detail" | "thank_you", country: HeurekaCountry = "cz"): void {
  const loadedKey = `${country}:${page}`;
  if (typeof window === "undefined" || loadedPages.has(loadedKey)) return;
  loadedPages.add(loadedKey);

  const w = window as unknown as Record<string, unknown>;
  const key = "heureka";
  // The SDK finds its call queue through window.ROIDataObject (the name of the
  // global) — Heureka's snippet sets it first, and without it every queued call
  // is silently ignored (2026-10-30: 0 conversions recorded in 14 days against
  // ~86 real Heureka orders). The stub also queues the `arguments` object
  // exactly like the snippet, rather than a rest-param array.
  w.ROIDataObject = key;
  if (!w[key]) {
    const stub = function (this: unknown) {
      // eslint-disable-next-line prefer-rest-params
      (stub.q = stub.q || []).push(arguments);
    } as unknown as Window["heureka"] & { q: unknown[] };
    stub.q = [];
    w[key] = stub;
  }
  (w[key] as Window["heureka"])!.c = country;

  const script = document.createElement("script");
  script.async = true;
  script.src = `//www.heureka.${country}/ocm/sdk.js?version=2&page=${page}`;
  document.head.appendChild(script);
}
