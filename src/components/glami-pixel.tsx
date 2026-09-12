"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent-context";

const PIXEL_KEY = process.env.NEXT_PUBLIC_GLAMI_PIXEL_KEY;

let pixelLoaded = false;

function loadPixel(apiKey: string) {
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

  window.glami?.("create", apiKey, "cz", { consent: 1 });
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
export function GlamiPixel() {
  const { consent } = useConsent();
  const pathname = usePathname();
  const isOrderPage = pathname?.startsWith("/objednavka");

  useEffect(() => {
    if (consent?.marketing && PIXEL_KEY && !isOrderPage) {
      loadPixel(PIXEL_KEY);
    }
  }, [consent?.marketing, isOrderPage]);

  return null;
}
