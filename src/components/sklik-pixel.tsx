"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent-context";
import { loadSklikScript } from "@/lib/sklik";

const RETARGETING_ID = process.env.NEXT_PUBLIC_SKLIK_RETARGETING_ID;

let hitSent = false;

/**
 * Loads the Seznam Sklik retargeting tag only after marketing consent (same
 * TZ §5.9 gate as MetaPixel) and never on the order confirmation page —
 * mirrors src/components/meta-pixel.tsx's PII-avoidance pattern. Purchase
 * value is reported separately by SklikConversion, rendered only on that
 * page.
 */
export function SklikPixel() {
  const { consent } = useConsent();
  const pathname = usePathname();
  const isOrderPage = pathname?.startsWith("/objednavka");

  useEffect(() => {
    if (!consent?.marketing || !RETARGETING_ID || isOrderPage || hitSent) return;
    hitSent = true;
    loadSklikScript()
      .then(() => window.rc?.retargetingHit({ rtgId: Number(RETARGETING_ID), consent: 1 }))
      .catch(() => {
        hitSent = false;
      });
  }, [consent?.marketing, isOrderPage]);

  return null;
}
