import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { ShippingMethod } from "@prisma/client";

export interface ShopSettings {
  freeShippingThreshold: number;
  shippingPrices: Record<ShippingMethod, number>;
}

/** `cache()` dedupes repeated calls within one request (e.g. layout + page both reading settings). */
export const getSettings = cache(async (): Promise<ShopSettings> => {
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
    },
  };
});
