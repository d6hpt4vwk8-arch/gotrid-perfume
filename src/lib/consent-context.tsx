"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { CONSENT_COOKIE_NAME, type ConsentState } from "@/lib/consent-cookie";

export type { ConsentState };

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function pushConsentModeUpdate(state: ConsentState) {
  window.gtag?.("consent", "update", {
    ad_storage: state.marketing ? "granted" : "denied",
    ad_user_data: state.marketing ? "granted" : "denied",
    ad_personalization: state.marketing ? "granted" : "denied",
    analytics_storage: state.analytics ? "granted" : "denied",
  });
}

interface ConsentContextValue {
  consent: ConsentState | null; // null = not yet decided
  acceptAll: () => void;
  rejectAll: () => void;
  setPreferences: (state: ConsentState) => void;
}

// A cookie (not localStorage) so the very first server-rendered response
// already knows the visitor's choice — (shop)/layout.tsx parses it (see
// CONSENT_COOKIE_NAME's own comment in consent-cookie.ts for why that's a
// plain module and not imported from here) and passes the result in as
// initialConsent. That's what lets CookieBanner render correctly hidden
// from the very first paint for a visitor who already answered, instead of
// the old localStorage version, which couldn't be read until a post-mount
// effect ran and so flashed the banner open for one paint on every reload.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
// The pre-cookie version of this stored the same decision here — read once,
// client-side only, to carry an already-decided visitor's choice over
// without re-prompting them; every write from here on goes to the cookie.
const LEGACY_LOCALSTORAGE_KEY = "gotrid-consent";

function writeConsentCookie(state: ConsentState) {
  document.cookie = `${CONSENT_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(state))}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function readLegacyLocalStorageConsent(): ConsentState | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.analytics === "boolean" && typeof parsed?.marketing === "boolean") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function ConsentProvider({
  children,
  initialConsent,
}: {
  children: ReactNode;
  /** Parsed server-side from the CONSENT_COOKIE_NAME cookie — null if the visitor hasn't decided yet. */
  initialConsent: ConsentState | null;
}) {
  const [consent, setConsent] = useState<ConsentState | null>(initialConsent);

  const decide = useCallback((state: ConsentState) => {
    pushConsentModeUpdate(state);
    writeConsentCookie(state);
    setConsent(state);
  }, []);
  const acceptAll = useCallback(() => decide({ analytics: true, marketing: true }), [decide]);
  const rejectAll = useCallback(() => decide({ analytics: false, marketing: false }), [decide]);
  const setPreferences = useCallback((state: ConsentState) => decide(state), [decide]);

  // One-time migration only — a visitor with no consent cookie yet (a first
  // visit, or one from before this switched to cookies) might still have a
  // decision saved in localStorage from the old version. Silently carry it
  // over instead of re-prompting someone who already answered.
  useEffect(() => {
    if (initialConsent !== null) return;
    const legacy = readLegacyLocalStorageConsent();
    if (legacy) decide(legacy);
    // Intentionally once-only: initialConsent/decide don't change identity
    // in a way that should re-trigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ConsentContext.Provider value={{ consent, acceptAll, rejectAll, setPreferences }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within ConsentProvider");
  return ctx;
}
