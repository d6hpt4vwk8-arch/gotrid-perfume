import type { ShippingMethod } from "@prisma/client";
import type { ShopSettings } from "@/lib/settings.server";

export const PICKUP_ADDRESS = "Na Jarově 2425/4, 130 00 Praha 3-Žižkov";

export const SHIPPING_LABELS: Record<ShippingMethod, string> = {
  ZASILKOVNA: "Zásilkovna — výdejní místo",
  PPL: "PPL kurýr",
  DPD: "DPD kurýr",
  BALIKOVNA: "Balíkovna",
  OSOBNI_ODBER: `Osobní odběr — ${PICKUP_ADDRESS}`,
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
  // Picking up in person at our own address has no carrier cost — always
  // free, not tied to the free-shipping threshold or Settings.
  if (method === "OSOBNI_ODBER") return 0;
  if (itemsTotal >= settings.freeShippingThreshold) return 0;
  return settings.shippingPrices[method];
}

// Above the free-shipping threshold we don't offer COD — a bank
// transfer/card is expected for higher-value orders, avoiding the
// no-show/non-collection risk of a large COD parcel.
export function canUseCod(itemsTotal: number, settings: ShopSettings): boolean {
  return itemsTotal < settings.freeShippingThreshold;
}

// Separate from getShippingPrice (carrier cost) so it stays accurate for
// reporting and the Heureka feed's DELIVERY_PRICE_COD even as the setting
// changes — applies regardless of the free-shipping threshold, since it
// covers COD handling/risk, not delivery itself.
export function getCodSurcharge(paymentMethod: string, settings: ShopSettings): number {
  return paymentMethod === "CASH_ON_DELIVERY" ? settings.codSurcharge : 0;
}
