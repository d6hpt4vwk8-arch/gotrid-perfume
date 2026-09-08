import { getSettings } from "@/lib/settings.server";
import { formatPrice } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { BenefitsRotator } from "@/components/benefits-rotator";

export async function BenefitsBar() {
  const [settings, giftCoupon] = await Promise.all([
    getSettings(),
    // Public "leak" of the gift promo: this bar is the only place the code
    // is announced site-wide (see CouponField/GiftPicker for where it's
    // redeemed) — deliberately not linked from anywhere else so it still
    // reads as "the customer had to notice this" rather than a popup nobody
    // can miss. Only ever surfaces one — if several GIFT coupons are active
    // at once, the newest wins.
    prisma.coupon.findFirst({
      where: {
        type: "GIFT",
        active: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { createdAt: "desc" },
    }).then((c) => (c && (c.usageLimit === null || c.usedCount < c.usageLimit) ? c : null)),
  ]);

  const items = [
    `Doprava zdarma od ${formatPrice(settings.freeShippingThreshold)}`,
    "Doručení do 2–3 pracovních dnů",
    "100 % originální produkty",
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
