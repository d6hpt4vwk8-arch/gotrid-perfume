import type { ShippingMethod } from "@prisma/client";
import type { ShopSettings } from "@/lib/settings.server";

export const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  ZASILKOVNA: "Zásilkovna — výdejní místo",
  PPL: "PPL kurýr",
  DPD: "DPD kurýr",
  BALIKOVNA: "Balíkovna",
};

export const PAYMENT_LABELS: Record<string, string> = {
  CARD: "Platba kartou online",
  BANK_TRANSFER: "Bankovní převod (QR platba)",
  CASH_ON_DELIVERY: "Dobírka",
};

// Pure function (no DB access) so it can run in both server code (create-order.ts)
// and be handed pre-fetched settings from a server component in client-rendered UI.
export function getShippingPrice(
  method: ShippingMethod,
  itemsTotal: number,
  settings: ShopSettings,
): number {
  if (itemsTotal >= settings.freeShippingThreshold) return 0;
  return settings.shippingPrices[method];
}
