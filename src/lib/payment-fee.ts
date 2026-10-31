import { currentSeller } from "@/lib/business-identity";
import type { ShopSettings } from "@/lib/settings.server";

const VAT_RATE = 0.21;

/**
 * What the card gateway (Comgate) keeps from one online card payment, for the net-profit figures. The rate in
 * settings is the standard one after the introductory discount, entered ex-VAT; a seller that isn't a VAT payer
 * can't reclaim the VAT on the fee, so it is added here. Only card orders pay it.
 */
export function getPaymentFee(
  paymentMethod: string,
  orderTotal: number,
  settings: Pick<ShopSettings, "paymentFeeCardPercent" | "paymentFeeCardFixed">,
): number {
  if (paymentMethod !== "CARD") return 0;
  const net = (orderTotal * settings.paymentFeeCardPercent) / 100 + settings.paymentFeeCardFixed;
  return currentSeller().vatPayer ? net : net * (1 + VAT_RATE);
}
