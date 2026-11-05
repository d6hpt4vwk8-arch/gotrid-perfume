// Seznam Event Measurement (SEM) — the new Sklik / Seznam Nákupy measurement that replaces the old
// retargeting + conversion codes (rc.js, see sklik.ts). Docs: napoveda.sklik.cz → Měřicí skripty →
// Seznam Event Measurement. The old codes keep running next to it until SEM is activated in Sklik
// ("Start using SEM" in Event Management) and verified; after that sklik.ts / sklik-pixel.tsx /
// sklik-conversion.tsx can go. One SEM ID serves Sklik and Seznam Nákupy (combined store ID).

declare global {
  interface Window {
    SEM?: (command: string, ...args: unknown[]) => void;
  }
}

export const SEM_ID = process.env.NEXT_PUBLIC_SEM_ID;

/** Shop VAT rate: SEM wants `value` ex VAT and `unit_price` incl. VAT; every product is sold at 21 %. */
export const SEM_VAT_RATE = 21;

export interface SemConsent {
  marketing: boolean;
  analytics: boolean;
}

let scriptLoading: Promise<void> | null = null;

/** Loads sul.js once; resolves when window.SEM is callable. Never called before marketing consent. */
export function loadSemScript(): Promise<void> {
  if (typeof window === "undefined" || !SEM_ID) return Promise.resolve();
  if (typeof window.SEM === "function") return Promise.resolve();
  if (scriptLoading) return scriptLoading;

  scriptLoading = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://l.seznam.cz/sul.js?id=${encodeURIComponent(SEM_ID)}`;
    script.async = true;
    script.onload = () => (typeof window.SEM === "function" ? resolve() : reject(new Error("SEM not defined after load")));
    script.onerror = () => reject(new Error("Failed to load Seznam sul.js"));
    document.head.appendChild(script);
  }).catch((err) => {
    scriptLoading = null;
    throw err;
  });
  return scriptLoading;
}

/** Google-Consent-Mode style signals (SEM's non-TCF path); must run before PageView or the `sid` cookie is missed. */
export function semUpdateConsent(consent: SemConsent) {
  const marketing = consent.marketing ? "granted" : "denied";
  window.SEM?.("updateConsent", {
    consent_mode: {
      ad_storage: marketing,
      ad_user_data: marketing,
      ad_personalization: marketing,
      functionality_storage: marketing,
      analytics_storage: consent.analytics ? "granted" : "denied",
    },
  });
}

export function semTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.SEM !== "function") return;
  if (params) window.SEM("track", event, params);
  else window.SEM("track", event);
}

export const exVat = (priceInclVat: number) => Math.round((priceInclVat / (1 + SEM_VAT_RATE / 100)) * 100) / 100;
