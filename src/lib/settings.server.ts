import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ShippingMethod } from "@prisma/client";

export interface ShopSettings {
  freeShippingThreshold: number;
  shippingPrices: Record<ShippingMethod, number>;
  // What the carrier actually bills us — for the net-profit figure on the
  // order detail page, distinct from shippingPrices (what the customer pays).
  shippingCosts: Record<ShippingMethod, number>;
  // Per-method cost of a parcel to Slovensko; a method missing here (or null) falls back to shippingCosts.
  shippingCostsSk: Partial<Record<ShippingMethod, number | null>>;
  // Null until the owner sets a real cross-border price in admin settings —
  // callers should fall back to shippingPrices.ZASILKOVNA until then.
  shippingPriceZasilkovnaSk: number | null;
  // Null until the owner sets a real Slovak GLS price — getShippingPrice() falls back to the CZ one.
  shippingPriceGlsSk: number | null;
  shippingPriceGlsMistoSk: number | null;
  codSurcharge: number;
  // Extra the carrier bills us on a COD parcel — added to the shipping cost of COD orders in profit figures.
  shippingCostCod: number;
  czkToEurRate: number;
  loyaltyEarnPercent: number;
  loyaltyRedeemCapPercent: number;
  loyaltyMinOrderValue: number;
  loyaltyExpiryMonths: number;
}

// Read on every storefront page (BenefitsBar, checkout, CartProvider) — like
// the category nav tree, this rarely changes so a 5-minute cache saves a DB
// round trip on nearly every request. Busted immediately when the admin
// saves shipping settings (see admin/actions/settings.ts).
export const getSettings = unstable_cache(
  async (): Promise<ShopSettings> => {
    const row = await prisma.settings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });

    return {
      freeShippingThreshold: Number(row.freeShippingThreshold),
      shippingPrices: {
        ZASILKOVNA: Number(row.shippingPriceZasilkovna),
        PPL: Number(row.shippingPricePpl),
        DPD: Number(row.shippingPriceDpd),
        BALIKOVNA: Number(row.shippingPriceBalikovna),
        GLS: Number(row.shippingPriceGls),
        GLS_MISTO: Number(row.shippingPriceGlsMisto),
        ZASILKOVNA_HD: Number(row.shippingPriceZasilkovnaHd),
        // Not DB-backed — personal pickup has no carrier cost, always free.
        OSOBNI_ODBER: 0,
      },
      shippingCosts: {
        ZASILKOVNA: Number(row.shippingCostZasilkovna),
        PPL: Number(row.shippingCostPpl),
        DPD: Number(row.shippingCostDpd),
        BALIKOVNA: Number(row.shippingCostBalikovna),
        GLS: Number(row.shippingCostGls),
        GLS_MISTO: Number(row.shippingCostGlsMisto),
        ZASILKOVNA_HD: Number(row.shippingCostZasilkovnaHd),
        OSOBNI_ODBER: 0,
      },
      shippingCostsSk: {
        ZASILKOVNA: row.shippingCostZasilkovnaSk === null ? null : Number(row.shippingCostZasilkovnaSk),
        GLS: row.shippingCostGlsSk === null ? null : Number(row.shippingCostGlsSk),
        GLS_MISTO: row.shippingCostGlsMistoSk === null ? null : Number(row.shippingCostGlsMistoSk),
      },
      shippingPriceZasilkovnaSk:
        row.shippingPriceZasilkovnaSk === null ? null : Number(row.shippingPriceZasilkovnaSk),
      shippingPriceGlsSk: row.shippingPriceGlsSk === null ? null : Number(row.shippingPriceGlsSk),
      shippingPriceGlsMistoSk:
        row.shippingPriceGlsMistoSk === null ? null : Number(row.shippingPriceGlsMistoSk),
      codSurcharge: Number(row.codSurcharge),
      shippingCostCod: Number(row.shippingCostCod),
      czkToEurRate: Number(row.czkToEurRate),
      loyaltyEarnPercent: row.loyaltyEarnPercent,
      loyaltyRedeemCapPercent: row.loyaltyRedeemCapPercent,
      loyaltyMinOrderValue: Number(row.loyaltyMinOrderValue),
      loyaltyExpiryMonths: row.loyaltyExpiryMonths,
    };
  },
  ["shop-settings"],
  { tags: ["shop-settings"], revalidate: 300 },
);
