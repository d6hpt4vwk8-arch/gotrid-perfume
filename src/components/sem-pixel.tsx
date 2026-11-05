"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/lib/consent-context";
import { SEM_ID, loadSemScript, semTrack, semUpdateConsent } from "@/lib/sem";

/**
 * Seznam Event Measurement (new Sklik / Seznam Nákupy tracking, see src/lib/sem.ts). Loaded only after
 * marketing consent — same gate as MetaPixel / SklikPixel — then the consent signals are sent first and
 * PageView after them (otherwise SEM misses the `sid` cookie). The shop is a single-page app, so PageView
 * is sent again on every route change. Skipped on the order confirmation page (its URL carries the order
 * number, like SklikPixel); the Purchase event there comes from SemPurchase.
 * Inert until NEXT_PUBLIC_SEM_ID is set.
 */
export function SemPixel() {
  const { consent } = useConsent();
  const pathname = usePathname();
  const isOrderPage = pathname?.startsWith("/objednavka");
  const [ready, setReady] = useState(false);
  const lastPath = useRef<string | null>(null);
  const marketing = Boolean(consent?.marketing);
  const analytics = Boolean(consent?.analytics);

  useEffect(() => {
    if (!SEM_ID) return;
    if (!marketing) {
      if (ready) {
        semUpdateConsent({ marketing: false, analytics: false });
        setReady(false);
        lastPath.current = null;
      }
      return;
    }
    let cancelled = false;
    loadSemScript()
      .then(() => {
        if (cancelled) return;
        semUpdateConsent({ marketing, analytics });
        setReady(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [marketing, analytics, ready]);

  useEffect(() => {
    if (!ready || isOrderPage || !pathname || lastPath.current === pathname) return;
    lastPath.current = pathname;
    semTrack("PageView");
  }, [ready, isOrderPage, pathname]);

  return null;
}
