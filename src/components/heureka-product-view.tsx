"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent-context";
import { HEUREKA_CONVERSION_KEYS, loadHeurekaScript, type HeurekaCountry } from "@/lib/heureka-conversion";

/**
 * Heureka's product-detail conversion-measurement tag — sets a cookie
 * noting the visitor arrived via Heureka, read later by HeurekaConversion
 * on the order confirmation page to attribute the sale back to Heureka.
 * `country` picks the shop account: the Slovak storefront uses Heureka.sk's SDK, the Czech one Heureka.cz's.
 *
 * Gated on `analytics` consent, matching HeurekaConversion (see its own
 * comment) — the two must stay on the same consent field, since a visitor
 * whose arrival never sets this cookie can never be attributed on the
 * thank-you page regardless of what that page's own gate allows.
 */
export function HeurekaProductView({ country = "cz" }: { country?: HeurekaCountry }) {
  const { consent } = useConsent();

  useEffect(() => {
    if (!consent?.analytics || !HEUREKA_CONVERSION_KEYS[country]) return;
    loadHeurekaScript("product_detail", country);
  }, [consent?.analytics, country]);

  return null;
}
