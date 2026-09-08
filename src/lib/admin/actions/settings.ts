"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/require-admin";

const settingsSchema = z.object({
  freeShippingThreshold: z.coerce.number().min(0).max(1_000_000),
  shippingPriceZasilkovna: z.coerce.number().min(0).max(10_000),
  // Cross-border SK price is optional — left blank means "not confirmed
  // yet", handled by getShippingPrice()'s fallback to the CZ price rather
  // than a guessed number.
  shippingPriceZasilkovnaSk: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v.trim() === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 10_000), {
      message: "Neplatná cena pro Slovensko.",
    }),
  shippingPricePpl: z.coerce.number().min(0).max(10_000),
  shippingPriceDpd: z.coerce.number().min(0).max(10_000),
  shippingPriceBalikovna: z.coerce.number().min(0).max(10_000),
  shippingPriceGls: z.coerce.number().min(0).max(10_000),
  codSurcharge: z.coerce.number().min(0).max(10_000),
  secondOrderDelayDays: z.coerce.number().int().min(1).max(365),
  secondOrderDiscountPercent: z.coerce.number().int().min(1).max(90),
  secondOrderCouponPrefix: z
    .string()
    .trim()
    .min(2)
    .max(20)
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "")),
});

export async function updateSettings(formData: FormData) {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Neplatná data.");

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });

  revalidatePath("/admin/nastaveni");
  revalidatePath("/pokladna");
  revalidateTag("shop-settings");
}
