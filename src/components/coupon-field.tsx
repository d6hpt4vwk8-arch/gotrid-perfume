"use client";

import { useEffect, useRef, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";

export interface AppliedCoupon {
  code: string;
  discountAmount: number;
  /** GIFT-type coupon — no discount, unlocks the free-gift picker instead. */
  grantsGift: boolean;
}

/**
 * Coupon entry shared by the cart and the checkout. The code itself lives in
 * the cart context (so a code entered in the cart carries over), but the
 * discount is always recomputed by /api/coupons/validate against the current
 * items total — and again server-side at order time.
 */
export function CouponField({ onApplied }: { onApplied?: (coupon: AppliedCoupon | null) => void }) {
  const { couponCode, setCouponCode, total: itemsTotal } = useCart();
  const [input, setInput] = useState("");
  const [applied, setApplied] = useState<AppliedCoupon | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const onAppliedRef = useRef(onApplied);
  onAppliedRef.current = onApplied;

  // Re-validates whenever the stored code or the cart total changes: a code
  // with a minimum order value has to fall away again if items are removed.
  useEffect(() => {
    if (!couponCode || itemsTotal <= 0) {
      setApplied(null);
      onAppliedRef.current?.(null);
      return;
    }
    let cancelled = false;
    setChecking(true);
    fetch("/api/coupons/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: couponCode, itemsTotal }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setApplied(null);
          onAppliedRef.current?.(null);
          setError(data.error ?? "Slevový kód se nepodařilo ověřit.");
          return;
        }
        setError(null);
        setApplied(data);
        onAppliedRef.current?.(data);
      })
      .catch(() => {
        if (cancelled) return;
        setApplied(null);
        onAppliedRef.current?.(null);
        setError("Slevový kód se nepodařilo ověřit.");
      })
      .finally(() => {
        if (!cancelled) setChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [couponCode, itemsTotal]);

  if (applied) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between rounded-sm border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ink">
          <span>
            Kód <strong>{applied.code}</strong> uplatněn
            {applied.grantsGift ? (
              " — vyberte si dárek zdarma níže"
            ) : (
              <> — sleva {formatPrice(applied.discountAmount)}</>
            )}
          </span>
          <button
            type="button"
            onClick={() => {
              setCouponCode(null);
              setInput("");
              setError(null);
            }}
            className="text-xs text-accent-2 underline hover:text-accent"
          >
            Odebrat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          placeholder="Slevový kód"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 rounded-sm border border-line px-3 py-2 text-sm text-ink"
        />
        <button
          type="button"
          onClick={() => setCouponCode(input.trim() || null)}
          disabled={checking || !input.trim()}
          className="rounded-sm border border-line px-4 py-2 text-sm font-medium text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? "Ověřuji…" : "Použít"}
        </button>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
