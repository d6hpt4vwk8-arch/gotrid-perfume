"use client";

import { useEffect } from "react";
import { useConsent } from "@/lib/consent-context";
import { trackViewContent } from "@/lib/analytics/client-events";

export function ProductViewTracker({
  product,
}: {
  product: { id: string; name: string; price: number };
}) {
  const { consent } = useConsent();

  useEffect(() => {
    if (consent?.marketing) {
      trackViewContent(product);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consent?.marketing, product.id]);

  return null;
}
