"use client";

import { useTr, useIsSk } from "@/i18n/use-tr";
import Image from "next/image";
import { Link, usePathname } from "@/i18n/navigation";
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
export function GiftPicker({ unlocked, onlyProductId }: { unlocked: boolean; onlyProductId?: string | null }) {
  const { giftProductId, setGiftProductId, items } = useCart();
  const { price } = useCurrency();
  const tr = useTr();
  const isSk = useIsSk();
  const [gifts, setGifts] = useState<GiftOption[]>([]);
  // Sample gifts a guest sees but cannot pick until they sign in (see createOrder()).
  const [lockedGifts, setLockedGifts] = useState<GiftOption[]>([]);
  const pathname = usePathname();
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
        ? fetch(onlyProductId ? `/api/gifts?productId=${encodeURIComponent(onlyProductId)}` : "/api/gifts")
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
            .then((d: { gifts: GiftOption[]; requiresAccount?: boolean }) => ({ gifts: d.gifts, requiresAccount: Boolean(d.requiresAccount) }))
            .catch(() => ({ gifts: [] as GiftOption[], requiresAccount: false }))
        : Promise.resolve({ gifts: [] as GiftOption[], requiresAccount: false }),
    ]).then(([couponGifts, samples]) => {
      if (cancelled) return;
      // One gift per order: coupon gifts and free samples share a single choice.
      setGifts(samples.requiresAccount ? couponGifts : [...samples.gifts, ...couponGifts]);
      setLockedGifts(samples.requiresAccount ? samples.gifts : []);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [unlocked, onlyProductId, cartKey]);

  // Drop a chosen gift that's no longer on offer (coupon removed, sample sold out, cart changed) —
  // otherwise checkout would submit a gift the server then rejects.
  useEffect(() => {
    if (!loaded || !giftProductId) return;
    if (!gifts.some((g) => g.productId === giftProductId)) setGiftProductId(null);
  }, [loaded, gifts, giftProductId, setGiftProductId]);

  if (!loaded || (gifts.length === 0 && lockedGifts.length === 0)) return null;

  const loginNext = encodeURIComponent(pathname || "/pokladna");

  const lockedBox = lockedGifts.length > 0 && (
    <div className="flex flex-col gap-2 rounded-sm border border-ok/40 bg-ok/5 p-3">
      <span className="text-sm font-semibold text-ink">{tr("Dárek zdarma pro registrované zákazníky")}</span>
      <span className="text-xs leading-snug text-accent-2">
        {tr("Přihlaste se nebo si vytvořte účet a vyberte si k objednávce jeden z těchto dárků.")}
      </span>
      <div className="flex flex-col gap-1.5">
        {lockedGifts.map((gift) => (
          <div key={gift.productId} className="flex items-center gap-3 rounded-sm border border-line bg-white/60 p-2 opacity-70">
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
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/prihlaseni?next=${loginNext}`}
          className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
        >
          {tr("Přihlásit se")}
        </Link>
        <Link
          href={`/registrace?next=${loginNext}`}
          className="rounded-sm border border-ink px-4 py-2 text-sm font-semibold text-ink hover:bg-white"
        >
          {tr("Vytvořit účet")}
        </Link>
      </div>
    </div>
  );

  if (gifts.length === 0) return lockedBox;

  return (
    <>
    {lockedBox}
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
    </>
  );
}
