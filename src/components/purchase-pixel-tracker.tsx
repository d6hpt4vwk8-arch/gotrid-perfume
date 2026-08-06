"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent-context";
import { trackPurchasePixelOnly } from "@/lib/analytics/client-events";

export function PurchasePixelTracker({ order }: { order: { number: string; total: number } }) {
  const { consent } = useConsent();

  useEffect(() => {
    if (consent?.marketing) {
      trackPurchasePixelOnly(order);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent?.marketing, order.number]);

  return null;
}
