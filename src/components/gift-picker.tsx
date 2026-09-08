"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/format";

interface GiftOption {
  productId: string;
  name: string;
  image: string | null;
  value: number;
}

/**
 * "Pick a free gift" list, shown in the cart and again at checkout. The
 * choice lives in the cart context so it survives the move between the two;
 * the threshold and eligibility are re-checked server-side in createOrder(),
 * this is only the shop window.
 */
export function GiftPicker() {
  const { total, giftProductId, setGiftProductId } = useCart();
  const [gifts, setGifts] = useState<GiftOption[]>([]);
  const [threshold, setThreshold] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/gifts")
      .then((res) => res.json())
      .then((data: { threshold: number; gifts: GiftOption[] }) => {
        if (cancelled) return;
        setThreshold(data.threshold);
        setGifts(data.gifts);
        setLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unlocked = threshold > 0 && total >= threshold;

  // Drop a gift that's no longer earned (items removed after picking it) —
  // otherwise checkout would submit a gift the server then rejects.
  useEffect(() => {
    if (loaded && giftProductId && !unlocked) setGiftProductId(null);
  }, [loaded, giftProductId, unlocked, setGiftProductId]);

  if (!loaded || threshold <= 0 || gifts.length === 0) return null;

  if (!unlocked) {
    return (
      <div className="rounded-sm border border-dashed border-line p-3 text-sm text-accent-2">
        Nakupte ještě za{" "}
        <span className="font-semibold text-ink">{formatPrice(threshold - total)}</span> a vyberte
        si dárek zdarma.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-ok/40 bg-ok/5 p-3">
      <span className="text-sm font-semibold text-ink">
        Dárek zdarma — vyberte si jeden
      </span>
      <div className="flex flex-col gap-1.5">
        {gifts.map((gift) => (
          <label
            key={gift.productId}
            className={`flex cursor-pointer items-center gap-3 rounded-sm border p-2 ${
              giftProductId === gift.productId ? "border-ink bg-white" : "border-line bg-white/60"
            }`}
          >
            <input
              type="radio"
              name="gift"
              checked={giftProductId === gift.productId}
              onChange={() => setGiftProductId(gift.productId)}
              className="accent-accent"
            />
            {gift.image && (
              <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-line/60">
                <Image src={gift.image} alt="" fill sizes="40px" className="object-cover" />
              </span>
            )}
            <span className="flex-1 text-sm text-ink">{gift.name}</span>
            <span className="text-xs text-accent-2">v hodnotě {formatPrice(gift.value)}</span>
          </label>
        ))}
      </div>
      {giftProductId && (
        <button
          type="button"
          onClick={() => setGiftProductId(null)}
          className="w-fit text-xs text-accent-2 underline hover:text-accent"
        >
          Dárek nechci
        </button>
      )}
    </div>
  );
}
