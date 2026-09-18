"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent-context";
import { loadHeurekaScript } from "@/lib/heureka-conversion";

const CONVERSION_KEY = process.env.NEXT_PUBLIC_HEUREKA_CONVERSION_KEY;

interface HeurekaOrderItem {
  itemId: string;
  name: string;
  unitPrice: number;
  qty: number;
}

/**
 * Reports a completed order to Heureka.cz's conversion measurement
 * (sluzby.heureka.cz/statistics-and-reports/conversion-measurement).
 * Rendered only on the order confirmation page, alongside SklikConversion.
 * `itemId` should match the feed's <ITEM_ID> (product.code) so Heureka can
 * reconcile against the catalog it already has.
 *
 * Gated on `analytics` consent, not `marketing` — owner's explicit call
 * (2026-09-18): this reports first-party order stats back to a price
 * comparison site the shop already lists on, not third-party ad
 * personalization, so it's closer to GA4-style analytics than a retargeting
 * pixel. Confirmed live via Heureka's own stats page that the marketing gate
 * left this at 0 counted conversions against 430 real clicks over a month —
 * most Heureka referrals never interact with the consent banner at all
 * before leaving or buying, so the stricter gate silently never fires.
 */
export function HeurekaConversion({
  orderId,
  items,
  totalVat,
}: {
  orderId: string;
  items: HeurekaOrderItem[];
  totalVat: number;
}) {
  const { consent } = useConsent();

  useEffect(() => {
    if (!consent?.analytics || !CONVERSION_KEY) return;
    loadHeurekaScript("thank_you");
    window.heureka?.("authenticate", CONVERSION_KEY);
    window.heureka?.("set_order_id", orderId);
    for (const item of items) {
      window.heureka?.("add_product", item.itemId, item.name, item.unitPrice, item.qty);
    }
    window.heureka?.("set_total_vat", totalVat);
    window.heureka?.("set_currency", "CZK");
    window.heureka?.("send", "Order");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent?.analytics, orderId]);

  return null;
}
