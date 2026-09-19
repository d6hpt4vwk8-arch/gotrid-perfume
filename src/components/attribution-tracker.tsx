"use client";

import { useEffect } from "react";
import { ATTRIBUTION_COOKIE, computeAttributionLabel } from "@/lib/attribution";

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days — long enough to cover a slow buyer

/**
 * Notes how a visitor first arrived (referrer/UTM), so the admin order view
 * can answer "where did this order come from" — purely a first-party note
 * on our own order records, never sent to or shared with an ad platform,
 * so (unlike MetaPixel/SklikPixel/GlamiPixel) this runs unconditionally
 * rather than behind marketing consent, the same call already made for the
 * order log itself (see heureka-conversion.tsx's comment).
 *
 * First-touch only: once the cookie exists, a later direct visit in the
 * same 30 days must not overwrite genuinely knowing they first arrived via
 * Heureka/an ad/etc.
 */
export function AttributionTracker() {
  useEffect(() => {
    if (document.cookie.split("; ").some((c) => c.startsWith(`${ATTRIBUTION_COOKIE}=`))) return;
    const label = computeAttributionLabel(document.referrer, window.location.search, window.location.hostname);
    document.cookie = `${ATTRIBUTION_COOKIE}=${encodeURIComponent(label)}; path=/; max-age=${MAX_AGE_SECONDS}; SameSite=Lax`;
  }, []);

  return null;
}
