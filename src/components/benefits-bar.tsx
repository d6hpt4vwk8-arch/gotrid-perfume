import { getSettings } from "@/lib/settings.server";
import { formatPrice } from "@/lib/format";
import { getActiveGiftCoupon } from "@/lib/gifts.server";
import { BenefitsRotator } from "@/components/benefits-rotator";

export async function BenefitsBar() {
  const [settings, giftCoupon] = await Promise.all([getSettings(), getActiveGiftCoupon()]);

  const items = [
    `Doprava zdarma od ${formatPrice(settings.freeShippingThreshold)}`,
    "Doručení do 2–3 pracovních dnů",
    "100 % originální produkty",
    // Public "leak" of the gift promo (see also the homepage hero slide) —
    // deliberately not linked from anywhere else so it still reads as "the
    // customer had to notice this" rather than a popup nobody can miss.
    ...(giftCoupon
      ? [
          `Dárek zdarma s kódem ${giftCoupon.code}${
            giftCoupon.minOrderValue ? ` při nákupu nad ${formatPrice(Number(giftCoupon.minOrderValue))}` : ""
          }`,
        ]
      : []),
  ];

  return (
    <div className="bg-ink">
      <div className="mx-auto max-w-6xl px-4 py-1.5">
        <BenefitsRotator items={items} />
      </div>
    </div>
  );
}
