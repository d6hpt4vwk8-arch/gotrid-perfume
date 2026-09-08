"use client";

import { useState } from "react";

/** Click-to-copy coupon code chip, e.g. for a promo banner's CTA. */
export function CopyCodeButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // Clipboard API can be unavailable (older browser, permissions) —
      // the code is still shown on the button, so the customer can select
      // and copy it manually.
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-2 rounded-sm border border-dashed border-white/40 bg-white/10 px-4 py-3 text-sm font-semibold tracking-wide text-white transition hover:border-white/70 hover:bg-white/15"
    >
      {copied ? (
        "Zkopírováno ✓"
      ) : (
        <>
          <span>{code}</span>
          <span className="text-xs font-normal text-white/60">Kopírovat</span>
        </>
      )}
    </button>
  );
}
