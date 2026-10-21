"use client";

import { useTr, useIsSk } from "@/i18n/use-tr";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";
import { useCurrency } from "@/lib/currency-context";

interface GiftOption {
  productId: string;
  name: string;
  nameSk?: string | null;
  image: string | null;
  value: number;
  blurb?: string | null;
  blurbSk?: string | null;
}

/**
 * "Pick a free gift" list: coupon gifts once a GIFT-type coupon is applied (see
 * CouponField), plus free sample gifts for carts holding K-beauty / Arabic perfume
 * (sample-gifts.ts) — in the cart and again at checkout. The choice lives in the
 * cart context so it survives the move between the two; coupon validity and
 * gift eligibility/stock are always re-checked server-side in createOrder(),
 * this is only the shop window.
 */
export function GiftPicker({ unlocked }: { unlocked: boolean }) {
  const { giftProductId, setGiftProductId, items } = useCart();
  const { price } = useCurrency();
  const tr = useTr();
  const isSk = useIsSk();
  const [gifts, setGifts] = useState<GiftOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Sample gifts depend on what is in the cart, so refetch when the set of products changes.
  const cartKey = items
    .map((i) => i.productId)
    .sort()
    .join(",");

  useEffect(() => {
    let cancelled = false;
    const productIds = cartKey ? cartKey.split(",") : [];
    Promise.all([
      unlocked
        ? fetch("/api/gifts")
            .then((res) => res.json())
            .then((d: { gifts: GiftOption[] }) => d.gifts)
            .catch(() => [] as GiftOption[])
        : Promise.resolve([] as GiftOption[]),
      productIds.length > 0
        ? fetch("/api/gifts/samples", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productIds }),
          })
            .then((res) => res.json())
            .then((d: { gifts: GiftOption[] }) => d.gifts)
            .catch(() => [] as GiftOption[])
        : Promise.resolve([] as GiftOption[]),
    ]).then(([couponGifts, sampleGifts]) => {
      if (cancelled) return;
      // One gift per order: coupon gifts and free samples share a single choice.
      setGifts([...sampleGifts, ...couponGifts]);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [unlocked, cartKey]);

  // Drop a chosen gift that's no longer on offer (coupon removed, sample sold out, cart changed) —
  // otherwise checkout would submit a gift the server then rejects.
  useEffect(() => {
    if (!loaded || !giftProductId) return;
    if (!gifts.some((g) => g.productId === giftProductId)) setGiftProductId(null);
  }, [loaded, gifts, giftProductId, setGiftProductId]);

  if (!loaded || gifts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-sm border border-ok/40 bg-ok/5 p-3">
      <span className="text-sm font-semibold text-ink">
        {tr("Dárek zdarma — vyberte si jeden")}
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
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-sm text-ink">{isSk && gift.nameSk ? gift.nameSk : gift.name}</span>
              {(isSk ? gift.blurbSk ?? gift.blurb : gift.blurb) && (
                <span className="text-xs leading-snug text-accent-2">{isSk ? gift.blurbSk ?? gift.blurb : gift.blurb}</span>
              )}
            </span>
            {gift.value > 0 && (
              <span className="text-xs text-accent-2">{tr("v hodnotě")} {price(gift.value)}</span>
            )}
          </label>
        ))}
      </div>
      {giftProductId && (
        <button
          type="button"
          onClick={() => setGiftProductId(null)}
          className="w-fit text-xs text-accent-2 underline hover:text-accent"
        >
          {tr("Dárek nechci")}
        </button>
      )}
    </div>
  );
}
