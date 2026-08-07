"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdmin } from "@/lib/admin/require-admin";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const couponSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Kód musí mít alespoň 2 znaky.")
    .max(50)
    .transform((v) => v.toUpperCase()),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().positive("Hodnota slevy musí být kladná."),
  active: z.coerce.boolean().default(false),
  minOrderValue: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  usageLimit: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
  expiresAt: z.preprocess(emptyToUndefined, z.string().optional()),
});

function parseCouponForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = couponSchema.safeParse({ ...raw, active: formData.get("active") === "on" });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Neplatná data slevového kódu.");
  }
  return parsed.data;
}

export async function createCoupon(formData: FormData) {
  await requireAdmin();
  const data = parseCouponForm(formData);

  const coupon = await prisma.coupon.create({
    data: {
      code: data.code,
      type: data.type,
      value: data.value,
      active: data.active,
      minOrderValue: data.minOrderValue,
      usageLimit: data.usageLimit,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
    },
  });
  await logAdminActivity({
    action: "coupon.create",
    entityType: "Coupon",
    entityId: coupon.id,
    detail: `Vytvořen kód ${coupon.code} (${coupon.type} ${coupon.value})`,
  });

  revalidatePath("/admin/slevove-kody");
}

export async function updateCoupon(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseCouponForm(formData);

  await prisma.coupon.update({
    where: { id },
    data: {
      code: data.code,
      type: data.type,
      value: data.value,
      active: data.active,
      minOrderValue: data.minOrderValue,
      usageLimit: data.usageLimit,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
  await logAdminActivity({
    action: "coupon.update",
    entityType: "Coupon",
    entityId: id,
    detail: `Upraven kód ${data.code}`,
  });

  revalidatePath("/admin/slevove-kody");
}

export async function deleteCoupon(id: string) {
  await requireAdmin();
  const coupon = await prisma.coupon.delete({ where: { id } });
  await logAdminActivity({
    action: "coupon.delete",
    entityType: "Coupon",
    entityId: id,
    detail: `Smazán kód ${coupon.code}`,
  });

  revalidatePath("/admin/slevove-kody");
}
