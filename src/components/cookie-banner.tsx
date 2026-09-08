"use client";

import { useState } from "react";
import { useConsent } from "@/lib/consent-context";

export function CookieBanner() {
  const { consent, acceptAll, rejectAll, setPreferences } = useConsent();
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  if (consent !== null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex w-full max-w-md flex-col gap-5 rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        <h2 className="text-2xl font-bold text-ink">Cookies</h2>

        {!showSettings ? (
          <>
            <p className="text-sm leading-relaxed text-neutral-700">
              Používáme cookies pro analytiku a marketing (Meta Pixel, Microsoft Clarity), abychom
              mohli měřit návštěvnost a zlepšovat nabídku. Nezbytné cookies (např. košík) běží vždy.
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShowSettings(true)}
                className="w-full rounded-md border border-neutral-300 px-4 py-3 text-sm font-medium text-ink hover:border-neutral-500"
              >
                Nastavení
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="w-full rounded-md bg-ink px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Přijmout vše
              </button>
            </div>
            <button
              type="button"
              onClick={rejectAll}
              className="text-center text-xs text-neutral-500 underline hover:text-neutral-800"
            >
              Odmítnout vše (pouze nezbytné cookies)
            </button>
          </>
        ) : (
          <>
            <label className="flex items-start gap-2.5 text-sm text-neutral-700">
              <input
                type="checkbox"
                checked={analyticsChecked}
                onChange={(e) => setAnalyticsChecked(e.target.checked)}
                className="mt-0.5"
              />
              Analytické a marketingové cookies (Meta Pixel, Microsoft Clarity)
            </label>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() =>
                  setPreferences({ analytics: analyticsChecked, marketing: analyticsChecked })
                }
                className="w-full rounded-md bg-ink px-4 py-3 text-sm font-medium text-white hover:bg-neutral-800"
              >
                Uložit nastavení
              </button>
            </div>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-center text-xs text-neutral-500 underline hover:text-neutral-800"
            >
              Zpět
            </button>
          </>
        )}
      </div>
    </div>
  );
}
