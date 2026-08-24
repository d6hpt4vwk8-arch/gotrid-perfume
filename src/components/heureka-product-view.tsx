"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent-context";
import { loadHeurekaScript } from "@/lib/heureka-conversion";

const CONVERSION_KEY = process.env.NEXT_PUBLIC_HEUREKA_CONVERSION_KEY;

/**
 * Heureka.cz's product-detail conversion-measurement tag — sets a cookie
 * noting the visitor arrived via Heureka, read later by HeurekaConversion
 * on the order confirmation page to attribute the sale back to Heureka.
 */
export function HeurekaProductView() {
  const { consent } = useConsent();

  useEffect(() => {
    if (!consent?.marketing || !CONVERSION_KEY) return;
    loadHeurekaScript("product_detail");
  }, [consent?.marketing]);

  return null;
}
