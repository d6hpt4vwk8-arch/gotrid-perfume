"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export interface ConsentState {
  analytics: boolean;
  marketing: boolean;
}

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

const STORAGE_KEY = "gotrid-consent";

const ConsentContext = createContext<ConsentContextValue | null>(null);

function readStoredConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setConsent(readStoredConsent());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated || !consent) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(consent));
  }, [consent, hydrated]);

  const acceptAll = useCallback(() => {
    const state = { analytics: true, marketing: true };
    pushConsentModeUpdate(state);
    setConsent(state);
  }, []);
  const rejectAll = useCallback(() => {
    const state = { analytics: false, marketing: false };
    pushConsentModeUpdate(state);
    setConsent(state);
  }, []);
  const setPreferences = useCallback((state: ConsentState) => {
    pushConsentModeUpdate(state);
    setConsent(state);
  }, []);

  return (
    <ConsentContext.Provider value={{ consent: hydrated ? consent : null, acceptAll, rejectAll, setPreferences }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within ConsentProvider");
  return ctx;
}
