"use client";

import { useEffect } from "react";
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
 * Reports a completed order to GLAMI Pixel's Purchase event
 * (glami.cz/info/pixel-implementace/). Rendered only on the order
 * confirmation page, alongside SklikConversion/HeurekaConversion — creates
 * its own pixel instance here rather than relying on GlamiPixel (which
 * deliberately skips this page), same split as SklikPixel/SklikConversion.
 * `itemIds` should match the feed's <ITEM_ID> (product.code).
 */
export function GlamiConversion({
  orderId,
  itemIds,
  value,
  createdAt,
}: {
  orderId: string;
  itemIds: string[];
  value: number;
  /** ISO time the order was placed — a confirmation page reopened later must not report a second sale. */
  createdAt: string;
}) {
  const { consent } = useConsent();

  useEffect(() => {
    if (!consent?.marketing || !PIXEL_KEY) return;
    // GLAMI's own transaction_id de-duplication didn't hold: the 2026-10 stats show the same
    // order totals again on a later day (order page reopened from the e-mail), inflating orders.
    // Report only a fresh order, and only once per browser.
    if (Date.now() - new Date(createdAt).getTime() > 3 * 60 * 60 * 1000) return;
    const key = `glami-purchase-${orderId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {}
    loadPixel(PIXEL_KEY);
    window.glami?.("track", "Purchase", {
      consent: 1,
      item_ids: itemIds,
      value,
      currency: "CZK",
      transaction_id: orderId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent?.marketing, orderId, createdAt]);

  return null;
}
