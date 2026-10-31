"use client";

import { useState } from "react";

/** Click-to-copy chip for a personal coupon code in "Můj účet". */
export function CopyCoupon({ code, copyLabel, copiedLabel }: { code: string; copyLabel: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          // The code is visible on the button, so it can still be copied by hand.
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="flex items-center gap-2 rounded-sm border border-dashed border-ink/40 bg-white px-3 py-1.5 text-sm font-semibold tracking-wider text-ink hover:border-ink"
    >
      {code}
      <span className="text-xs font-normal tracking-normal text-accent-2">{copied ? copiedLabel : copyLabel}</span>
    </button>
  );
}
