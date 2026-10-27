import { getSettings } from "@/lib/settings.server";
import { formatPriceIn } from "@/lib/format";
import { currencyForLocale } from "@/lib/currency";
import { getCurrentLocale, getTr } from "@/i18n/tr.server";
import { getActiveGiftCoupon } from "@/lib/gifts.server";
import { BenefitsRotator } from "@/components/benefits-rotator";

export async function BenefitsBar() {
  const [settings, giftCoupon] = await Promise.all([getSettings(), getActiveGiftCoupon()]);
  const currency = currencyForLocale(await getCurrentLocale());
  const tr = await getTr();
  const price = (czk: number) => formatPriceIn(czk, currency, settings.czkToEurRate);

  const items = [
    tr("Doprava zdarma od {price}", { price: price(settings.freeShippingThreshold) }),
    tr("Doručení do 2–3 pracovních dnů"),
    tr("100 % originální produkty"),
    // Public "leak" of the gift promo (see also the homepage hero slide) —
    // deliberately not linked from anywhere else so it still reads as "the
    // customer had to notice this" rather than a popup nobody can miss.
    ...(giftCoupon
      ? [
          tr("Dárek zdarma s kódem {code}", { code: giftCoupon.code }) +
            (giftCoupon.minOrderValue
              ? " " + tr("při nákupu nad {price}", { price: price(Number(giftCoupon.minOrderValue)) })
              : ""),
        ]
      : []),
  ];

  return (
    <div className="bg-ink">
      <div className="mx-auto max-w-(--page-max) px-4 py-1.5 xl:px-8">
        <BenefitsRotator items={items} />
      </div>
    </div>
  );
}
