"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent-context";

export type GlamiCountry = "cz" | "sk";

// Two separate GLAMI shops: glami.cz (GotridPerfume.cz) and glami.sk (GotridPerfume.sk, merchant 2697). The pixel key is
// public by design (GLAMI's snippet embeds it in every page), so the Slovak one is the default and only overridable.
export const GLAMI_PIXEL_KEYS: Record<GlamiCountry, string | undefined> = {
  cz: process.env.NEXT_PUBLIC_GLAMI_PIXEL_KEY,
  sk: process.env.NEXT_PUBLIC_GLAMI_SK_PIXEL_KEY ?? "eb625fbd3b820e0607d5cd49fb499625",
};

let pixelLoaded = false;

declare global {
  interface Window {
    /** Set once the pixel is created: ViewContent/AddToCart (client-events.ts) read it to report EUR on the Slovak shop. */
    glamiMeta?: { currency: "CZK" | "EUR"; czkPerEur: number };
  }
}

function loadPixel(apiKey: string, country: GlamiCountry, czkPerEur: number) {
  if (pixelLoaded || typeof window === "undefined") return;
  pixelLoaded = true;

  /* eslint-disable */
  (function (f: any, a: any, s: any, h: any, i: any) {
    f[i] = f[i] || function () {
      (f[i].q = f[i].q || []).push(arguments);
    };
    const o = a.createElement(s);
    const n = a.getElementsByTagName(s)[0];
    o.async = 1;
    o.src = h;
    n.parentNode.insertBefore(o, n);
  })(window, document, "script", "//glamipixel.com/js/compiled/pt.js", "glami");
  /* eslint-enable */

  window.glamiMeta = { currency: country === "sk" ? "EUR" : "CZK", czkPerEur };
  window.glami?.("create", apiKey, country, { consent: 1 });
  window.glami?.("track", "PageView", { consent: 1 });
}

/**
 * GLAMI Pixel (glami.cz/info/pixel-implementace/) — loads only after
 * marketing consent, same gate as MetaPixel/SklikPixel, and never on the
 * order confirmation page: that page's own Purchase event (GlamiConversion)
 * creates the pixel itself with the real order data, mirroring how
 * SklikPixel/SklikConversion split the same two responsibilities.
 * ViewContent/AddToCart are fired from src/lib/analytics/client-events.ts
 * alongside the existing Meta Pixel calls, once this has run.
 */
export function GlamiPixel({ country = "cz", czkPerEur = 25 }: { country?: GlamiCountry; czkPerEur?: number }) {
  const { consent } = useConsent();
  const pathname = usePathname();
  const isOrderPage = pathname?.startsWith("/objednavka");

  useEffect(() => {
    const key = GLAMI_PIXEL_KEYS[country];
    if (consent?.marketing && key && !isOrderPage) {
      loadPixel(key, country, czkPerEur);
    }
  }, [consent?.marketing, isOrderPage, country, czkPerEur]);

  return null;
}
