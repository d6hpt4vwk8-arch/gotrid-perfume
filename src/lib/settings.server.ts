import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { ShippingMethod } from "@prisma/client";

export interface ShopSettings {
  freeShippingThreshold: number;
  shippingPrices: Record<ShippingMethod, number>;
  codSurcharge: number;
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
        // Not DB-backed — personal pickup has no carrier cost, always free.
        OSOBNI_ODBER: 0,
      },
      codSurcharge: Number(row.codSurcharge),
    };
  },
  ["shop-settings"],
  { tags: ["shop-settings"], revalidate: 300 },
);
