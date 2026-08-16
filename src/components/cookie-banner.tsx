"use client";

import { useState } from "react";
import { useConsent } from "@/lib/consent-context";

export function CookieBanner() {
  const { consent, acceptAll, rejectAll, setPreferences } = useConsent();
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  if (consent !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-neutral-200 bg-white p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        {!showSettings ? (
          <>
            <p className="text-sm text-neutral-700">
              Používáme cookies pro analytiku a marketing (Meta Pixel, Microsoft Clarity),
              abychom mohli měřit návštěvnost a zlepšovat nabídku. Nezbytné cookies (např. košík)
              běží vždy.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={acceptAll}
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
              >
                Souhlasím
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:border-neutral-500"
              >
                Odmítnout
              </button>
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="rounded-md px-4 py-2 text-sm font-medium text-neutral-600 underline hover:text-neutral-900"
              >
                Nastavení
              </button>
            </div>
          </>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={analyticsChecked}
                onChange={(e) => setAnalyticsChecked(e.target.checked)}
              />
              Analytické a marketingové cookies (Meta Pixel, Microsoft Clarity)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setPreferences({ analytics: analyticsChecked, marketing: analyticsChecked })
                }
                className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
              >
                Uložit nastavení
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
