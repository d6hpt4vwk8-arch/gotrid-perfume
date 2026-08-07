"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/require-admin";

const settingsSchema = z.object({
  freeShippingThreshold: z.coerce.number().min(0).max(1_000_000),
  shippingPriceZasilkovna: z.coerce.number().min(0).max(10_000),
  shippingPricePpl: z.coerce.number().min(0).max(10_000),
  shippingPriceDpd: z.coerce.number().min(0).max(10_000),
  shippingPriceBalikovna: z.coerce.number().min(0).max(10_000),
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
