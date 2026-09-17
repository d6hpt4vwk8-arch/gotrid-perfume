import { headers } from "next/headers";
import { getSettings } from "@/lib/settings.server";
import { formatPriceIn } from "@/lib/format";
import { readCurrencyCookie } from "@/lib/currency-cookie";
import { getActiveGiftCoupon } from "@/lib/gifts.server";
import { BenefitsRotator } from "@/components/benefits-rotator";

export async function BenefitsBar() {
  const [settings, giftCoupon, headerList] = await Promise.all([
    getSettings(),
    getActiveGiftCoupon(),
    headers(),
  ]);
  const currency = readCurrencyCookie(headerList.get("cookie"));
  const price = (czk: number) => formatPriceIn(czk, currency, settings.czkToEurRate);

  const items = [
    `Doprava zdarma od ${price(settings.freeShippingThreshold)}`,
    "Doručení do 2–3 pracovních dnů",
    "100 % originální produkty",
    // Public "leak" of the gift promo (see also the homepage hero slide) —
    // deliberately not linked from anywhere else so it still reads as "the
    // customer had to notice this" rather than a popup nobody can miss.
    ...(giftCoupon
      ? [
          `Dárek zdarma s kódem ${giftCoupon.code}${
            giftCoupon.minOrderValue ? ` při nákupu nad ${price(Number(giftCoupon.minOrderValue))}` : ""
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
