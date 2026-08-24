// Shared script loader for Heureka.cz's conversion-measurement "OCM SDK"
// (sluzby.heureka.cz/statistics-and-reports/conversion-measurement). Two
// pages need it with a different `page=` query param — product detail
// (src/components/heureka-product-view.tsx, sets a cookie noting the
// visitor arrived via Heureka) and the order confirmation page
// (src/components/heureka-conversion.tsx, reports the actual sale). Both
// share the same `window.heureka` queue-stub, reproduced here exactly per
// Heureka's own snippet — the stub queues calls made before the real script
// finishes downloading, so callers don't need to wait for a load event.

declare global {
  interface Window {
    heureka?: ((...args: unknown[]) => void) & { q?: unknown[]; c?: string };
  }
}

const loadedPages = new Set<string>();

export function loadHeurekaScript(page: "product_detail" | "thank_you"): void {
  if (typeof window === "undefined" || loadedPages.has(page)) return;
  loadedPages.add(page);

  const w = window as unknown as Record<string, unknown>;
  const key = "heureka";
  if (!w[key]) {
    const stub = ((...args: unknown[]) => {
      (stub.q = stub.q || []).push(args);
    }) as Window["heureka"] & { q: unknown[] };
    stub.q = [];
    w[key] = stub;
  }
  (w[key] as Window["heureka"])!.c = "cz";

  const script = document.createElement("script");
  script.async = true;
  script.src = `//www.heureka.cz/ocm/sdk.js?version=2&page=${page}`;
  document.head.appendChild(script);
}
