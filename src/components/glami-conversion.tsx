"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent-context";
import { GLAMI_PIXEL_KEYS, type GlamiCountry } from "@/components/glami-pixel";

let pixelLoaded = false;

function loadPixel(apiKey: string, country: GlamiCountry) {
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

  window.glami?.("create", apiKey, country, { consent: 1 });
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
  country = "cz",
}: {
  orderId: string;
  itemIds: string[];
  value: number;
  /** ISO time the order was placed — a confirmation page reopened later must not report a second sale. */
  createdAt: string;
  /** Which GLAMI shop the order belongs to: a Slovak order is reported to glami.sk, `value` then in EUR. */
  country?: GlamiCountry;
}) {
  const { consent } = useConsent();

  useEffect(() => {
    const pixelKey = GLAMI_PIXEL_KEYS[country];
    if (!consent?.marketing || !pixelKey) return;
    // GLAMI's own transaction_id de-duplication didn't hold: the 2026-10 stats show the same
    // order totals again on a later day (order page reopened from the e-mail), inflating orders.
    // Report only a fresh order, and only once per browser.
    if (Date.now() - new Date(createdAt).getTime() > 3 * 60 * 60 * 1000) return;
    const key = `glami-purchase-${orderId}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {}
    loadPixel(pixelKey, country);
    window.glami?.("track", "Purchase", {
      consent: 1,
      item_ids: itemIds,
      value,
      currency: country === "sk" ? "EUR" : "CZK",
      transaction_id: orderId,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent?.marketing, orderId, createdAt, country]);

  return null;
}
