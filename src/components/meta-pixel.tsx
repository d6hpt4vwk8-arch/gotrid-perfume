"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent-context";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

let pixelLoaded = false;

function loadPixel(pixelId: string) {
  if (pixelLoaded || typeof window === "undefined") return;
  pixelLoaded = true;

  /* eslint-disable */
  (function (f: any, b: any, e: any, v: any) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const t = b.createElement(e);
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq?.("init", pixelId);
  window.fbq?.("track", "PageView");
}

/** Loads Meta Pixel only after marketing consent (TZ §5.9: block trackers until Souhlasím). */
export function MetaPixel() {
  const { consent } = useConsent();

  useEffect(() => {
    if (consent?.marketing && PIXEL_ID) {
      loadPixel(PIXEL_ID);
    }
  }, [consent?.marketing]);

  return null;
}
