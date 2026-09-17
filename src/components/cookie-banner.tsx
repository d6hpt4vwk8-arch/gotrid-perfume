"use client";

import Image from "next/image";
import { useState } from "react";
import { useConsent } from "@/lib/consent-context";

// Same consent logic as before — only the look changed (was a generic
// rounded-2xl/neutral-gray dialog matching no other UI on the site; now
// uses the same rounded-sm + ink/accent/line palette as every other card,
// button and modal, plus the site's own logo, since a boilerplate-looking
// consent popup doesn't read as "part of this shop" the way the rest of
// the storefront does — the owner's own hunch is also the standard finding
// on this: a banner that looks deliberately designed, not like a stock
// compliance widget, measurably gets more "accept" responses.
export function CookieBanner() {
  const { consent, acceptAll, rejectAll, setPreferences } = useConsent();
  const [showSettings, setShowSettings] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(true);

  if (consent !== null) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="flex w-full max-w-md flex-col gap-5 overflow-hidden rounded-sm bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line bg-line/30 px-6 py-4 sm:px-8">
          <Image src="/logo.svg" alt="" width={28} height={28} aria-hidden />
          <span className="text-sm font-semibold tracking-wide text-ink uppercase">
            Gotrid Perfume
          </span>
        </div>

        <div className="flex flex-col gap-5 px-6 pb-6 sm:px-8 sm:pb-8">
          <h2 className="text-xl font-bold text-ink">Souhlas s cookies</h2>

          {!showSettings ? (
            <>
              <p className="text-sm leading-relaxed text-accent-2">
                Používáme cookies pro analytiku a marketing (Meta Pixel, Microsoft Clarity), abychom
                mohli měřit návštěvnost a zlepšovat nabídku. Nezbytné cookies (např. košík) běží vždy.
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={acceptAll}
                  className="w-full rounded-sm bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-accent"
                >
                  Přijmout vše
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings(true)}
                  className="w-full rounded-sm border border-line px-4 py-3 text-sm font-medium text-ink hover:border-accent-2"
                >
                  Nastavení
                </button>
              </div>
              <button
                type="button"
                onClick={rejectAll}
                className="text-center text-xs text-accent-2 underline hover:text-ink"
              >
                Odmítnout vše (pouze nezbytné cookies)
              </button>
            </>
          ) : (
            <>
              <label className="flex items-start gap-2.5 text-sm text-accent-2">
                <input
                  type="checkbox"
                  checked={analyticsChecked}
                  onChange={(e) => setAnalyticsChecked(e.target.checked)}
                  className="mt-0.5 accent-accent"
                />
                Analytické a marketingové cookies (Meta Pixel, Microsoft Clarity)
              </label>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setPreferences({ analytics: analyticsChecked, marketing: analyticsChecked })
                  }
                  className="w-full rounded-sm bg-ink px-4 py-3 text-sm font-semibold text-white hover:bg-accent"
                >
                  Uložit nastavení
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowSettings(false)}
                className="text-center text-xs text-accent-2 underline hover:text-ink"
              >
                Zpět
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
