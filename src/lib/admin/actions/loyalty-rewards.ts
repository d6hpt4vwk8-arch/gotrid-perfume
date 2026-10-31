"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdmin } from "@/lib/admin/require-admin";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const rewardSchema = z.object({
  name: z.string().trim().min(2, "Zadejte název odměny.").max(120),
  nameSk: z.preprocess(emptyToUndefined, z.string().trim().max(120).optional()),
  pointsCost: z.coerce.number().int().positive("Cena v bodech musí být kladná."),
  type: z.enum(["FIXED", "FREE_SHIPPING", "GIFT"]),
  value: z.coerce.number().min(0).default(0),
  minOrderValue: z.preprocess(emptyToUndefined, z.coerce.number().min(0).optional()),
  // The product's catalog code (as in the product admin) — resolved to its id below.
  giftProductCode: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  validDays: z.coerce.number().int().min(1).max(730).default(60),
  sortOrder: z.coerce.number().int().default(0),
  active: z.coerce.boolean().default(false),
});

async function parseRewardForm(formData: FormData) {
  const parsed = rewardSchema.safeParse({ ...Object.fromEntries(formData), active: formData.get("active") === "on" });
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Neplatná data odměny.");
  const d = parsed.data;
  if (d.type === "FIXED" && d.value <= 0) throw new Error("Sleva v Kč musí být kladná.");
  let giftProductId: string | null = null;
  if (d.type === "GIFT" && d.giftProductCode) {
    const product = await prisma.product.findFirst({ where: { code: d.giftProductCode }, select: { id: true } });
    if (!product) throw new Error(`Produkt s kódem „${d.giftProductCode}“ neexistuje.`);
    giftProductId = product.id;
  }
  return {
    name: d.name,
    nameSk: d.nameSk ?? null,
    pointsCost: d.pointsCost,
    type: d.type,
    value: d.type === "FIXED" ? d.value : 0,
    minOrderValue: d.type === "FIXED" ? (d.minOrderValue ?? null) : null,
    giftProductId,
    validDays: d.validDays,
    sortOrder: d.sortOrder,
    active: d.active,
  };
}

export async function createLoyaltyReward(formData: FormData) {
  await requireAdmin();
  const data = await parseRewardForm(formData);
  const reward = await prisma.loyaltyReward.create({ data });
  await logAdminActivity({
    action: "loyalty_reward.create",
    entityType: "LoyaltyReward",
    entityId: reward.id,
    detail: `Odměna „${reward.name}“ za ${reward.pointsCost} bodů`,
  });
  revalidatePath("/admin/body-odmeny");
}

export async function updateLoyaltyReward(id: string, formData: FormData) {
  await requireAdmin();
  const data = await parseRewardForm(formData);
  await prisma.loyaltyReward.update({ where: { id }, data });
  await logAdminActivity({
    action: "loyalty_reward.update",
    entityType: "LoyaltyReward",
    entityId: id,
    detail: `Odměna „${data.name}“: ${data.pointsCost} bodů, ${data.active ? "aktivní" : "vypnutá"}`,
  });
  revalidatePath("/admin/body-odmeny");
}

export async function deleteLoyaltyReward(id: string) {
  await requireAdmin();
  const reward = await prisma.loyaltyReward.delete({ where: { id } });
  await logAdminActivity({
    action: "loyalty_reward.delete",
    entityType: "LoyaltyReward",
    entityId: id,
    detail: `Smazána odměna „${reward.name}“`,
  });
  revalidatePath("/admin/body-odmeny");
}
