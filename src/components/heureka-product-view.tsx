"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent-context";
import { loadHeurekaScript } from "@/lib/heureka-conversion";

const CONVERSION_KEY = process.env.NEXT_PUBLIC_HEUREKA_CONVERSION_KEY;

/**
 * Heureka.cz's product-detail conversion-measurement tag — sets a cookie
 * noting the visitor arrived via Heureka, read later by HeurekaConversion
 * on the order confirmation page to attribute the sale back to Heureka.
 *
 * Gated on `analytics` consent, matching HeurekaConversion (see its own
 * comment) — the two must stay on the same consent field, since a visitor
 * whose arrival never sets this cookie can never be attributed on the
 * thank-you page regardless of what that page's own gate allows.
 */
export function HeurekaProductView() {
  const { consent } = useConsent();

  useEffect(() => {
    if (!consent?.analytics || !CONVERSION_KEY) return;
    loadHeurekaScript("product_detail");
  }, [consent?.analytics]);

  return null;
}
