"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent-context";
import { loadSklikScript } from "@/lib/sklik";

const CONVERSION_ID = process.env.NEXT_PUBLIC_SKLIK_CONVERSION_ID;
const ZBOZI_SHOP_ID = process.env.NEXT_PUBLIC_ZBOZI_SHOP_ID;

/**
 * Reports a completed order to Sklik's conversion measurement
 * (napoveda.sklik.cz/merici-skripty/konverzni-kod/) and, in the same call,
 * to Zboží.cz's client-side conversion tag (github.com/seznam/zbozi-konverze
 * — both products share the same rc.js/conversionHit mechanism, just with
 * different id fields: Sklik's `id` vs Zboží's `zboziId`). Rendered only on
 * the order confirmation page. `orderId` dedupes if the page is reloaded
 * (both also have their own repeat-load guards server-side); `value` must
 * already be ex-shipping/ex-VAT (see calculateSklikConversionValue below).
 * Either ID can be configured independently — fires as long as at least one is set.
 */
export function SklikConversion({ orderId, value }: { orderId: string; value: number }) {
  const { consent } = useConsent();

  useEffect(() => {
    if (!consent?.marketing || (!CONVERSION_ID && !ZBOZI_SHOP_ID)) return;
    loadSklikScript().then(() =>
      window.rc?.conversionHit({
        ...(CONVERSION_ID && { id: Number(CONVERSION_ID) }),
        ...(ZBOZI_SHOP_ID && { zboziId: Number(ZBOZI_SHOP_ID), zboziType: "standard" }),
        value,
        orderId,
        consent: 1,
      }),
    );
  }, [consent?.marketing, orderId, value]);

  return null;
}
