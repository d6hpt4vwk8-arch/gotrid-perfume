"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Public certificate id from sluzby.heureka.cz → Ověřeno zákazníky (not the
// secret review-export key, which must never ship to the browser).
const CERTIFICATE_ID = process.env.NEXT_PUBLIC_HEUREKA_CERTIFICATE_ID ?? "60B937B419AC6CBEC8DCA9B30B71BFC8";

// Heureka widget 21 = slide-out "Ověřeno zákazníky" tab on the left edge
// (22 would be the right edge). Top offset keeps it clear of the header.
const WIDGET = "21";
const TOP_POS = "220";

let widgetLoaded = false;

function loadWidget() {
  if (widgetLoaded || typeof window === "undefined") return;
  widgetLoaded = true;

  const w = window as unknown as { _hwq?: unknown[][] };
  w._hwq = w._hwq || [];
  w._hwq.push(["setKey", CERTIFICATE_ID]);
  w._hwq.push(["setTopPos", TOP_POS]);
  w._hwq.push(["showWidget", WIDGET]);

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://cz.im9.cz/direct/i/gjs.php?n=wdgt&sak=${CERTIFICATE_ID}`;
  document.head.appendChild(script);
}

/**
 * Heureka's slide-out "Ověřeno zákazníky" certificate tab. Loaded for every
 * visitor, without waiting for cookie consent (owner's call, 2026-10-07): it
 * is a trust badge, not a tracker, and a badge that only shows to people who
 * clicked "accept" looks broken to everyone else. Stays off the order pages.
 */
export function HeurekaCertificateWidget() {
  const pathname = usePathname();
  const isOrderPage = pathname?.startsWith("/objednavka") || pathname?.startsWith("/pokladna");

  useEffect(() => {
    if (!isOrderPage) loadWidget();
  }, [isOrderPage]);

  return null;
}
