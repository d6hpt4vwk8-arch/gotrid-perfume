"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent-context";
import { loadSklikScript } from "@/lib/sklik";

const CONVERSION_ID = process.env.NEXT_PUBLIC_SKLIK_CONVERSION_ID;

/**
 * Reports a completed order to Sklik's conversion measurement
 * (napoveda.sklik.cz/merici-skripty/konverzni-kod/) — rendered only on the
 * order confirmation page. `orderId` dedupes if the page is reloaded (Sklik
 * also has its own 3-minute repeat-load guard); `value` must already be
 * ex-shipping/ex-VAT (see calculateSklikConversionValue in src/lib/sklik.ts).
 */
export function SklikConversion({ orderId, value }: { orderId: string; value: number }) {
  const { consent } = useConsent();

  useEffect(() => {
    if (!consent?.marketing || !CONVERSION_ID) return;
    loadSklikScript().then(() =>
      window.rc?.conversionHit({ id: Number(CONVERSION_ID), value, orderId, consent: 1 }),
    );
  }, [consent?.marketing, orderId, value]);

  return null;
}
