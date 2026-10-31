import type { ShopSettings } from "@/lib/settings.server";

/**
 * What the card gateway (Comgate) keeps from one online card payment, for the net-profit figures: a flat
 * percentage of the order total plus a fixed Kč amount per transaction, with one pair of values for Czech and
 * one for Slovak orders (settings, entered as the owner wants them counted — deliberately no VAT or tier logic).
 * Only card orders pay it.
 */
export function getPaymentFee(
  paymentMethod: string,
  orderTotal: number,
  shippingCountry: string,
  settings: Pick<
    ShopSettings,
    "paymentFeeCardPercent" | "paymentFeeCardFixed" | "paymentFeeCardPercentSk" | "paymentFeeCardFixedSk"
  >,
): number {
  if (paymentMethod !== "CARD") return 0;
  const sk = shippingCountry === "SK";
  const percent = sk ? settings.paymentFeeCardPercentSk : settings.paymentFeeCardPercent;
  const fixed = sk ? settings.paymentFeeCardFixedSk : settings.paymentFeeCardFixed;
  return (orderTotal * percent) / 100 + fixed;
}
