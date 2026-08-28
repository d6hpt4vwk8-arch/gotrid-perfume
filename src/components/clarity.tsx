"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent-context";

const PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;

let clarityLoaded = false;

function loadClarity(projectId: string) {
  if (clarityLoaded || typeof window === "undefined") return;
  clarityLoaded = true;

  /* eslint-disable */
  (function (c: any, l: any, a: any, r: any, i: any) {
    c[a] =
      c[a] ||
      function () {
        (c[a].q = c[a].q || []).push(arguments);
      };
    const t = l.createElement(r);
    t.async = true;
    t.src = "https://www.clarity.ms/tag/" + i;
    const y = l.getElementsByTagName(r)[0];
    y.parentNode.insertBefore(t, y);
  })(window, document, "clarity", "script", projectId);
  /* eslint-enable */

  // loadClarity() only ever runs after the visitor has already granted
  // analytics consent via our own cookie banner (see the gate below), so
  // there's nothing left to ask — tell Clarity's consent API right away.
  // Without this call Clarity runs cookie-less: it never sets _clck/_clsk,
  // so it can't stitch page views into one session and every single
  // pageview shows up in the dashboard as its own few-second "session"
  // (confirmed live: window.clarity was active but no _clck/_clsk cookie
  // existed until this call was made).
  (window as unknown as { clarity: (...args: unknown[]) => void }).clarity("consent");
}

/**
 * Microsoft Clarity (session recordings + heatmaps) — loads only after
 * analytics consent, same gate as Meta Pixel, and skips the order
 * confirmation page for the same reason (PII-bearing: email, order number).
 */
export function Clarity() {
  const { consent } = useConsent();
  const pathname = usePathname();
  const isOrderPage = pathname?.startsWith("/objednavka");

  useEffect(() => {
    if (consent?.analytics && PROJECT_ID && !isOrderPage) {
      loadClarity(PROJECT_ID);
    }
  }, [consent?.analytics, isOrderPage]);

  return null;
}
