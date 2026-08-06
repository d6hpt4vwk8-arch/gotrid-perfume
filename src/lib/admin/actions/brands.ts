"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";

const brandSchema = z.object({
  name: z.string().trim().min(1, "Název je povinný.").max(150),
});

function parseName(formData: FormData): string {
  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Neplatná data.");
  return parsed.data.name;
}

export async function createBrand(formData: FormData) {
  const name = parseName(formData);
  await prisma.brand.create({ data: { name, slug: slugify(name) } });
  revalidatePath("/admin/znacky");
}

export async function updateBrand(id: string, formData: FormData) {
  const name = parseName(formData);
  await prisma.brand.update({ where: { id }, data: { name } });
  revalidatePath("/admin/znacky");
}

export async function deleteBrand(id: string) {
  const productCount = await prisma.product.count({ where: { brandId: id } });
  if (productCount > 0) {
    throw new Error("Ke značce jsou přiřazeny produkty — nejdřív jim změňte značku.");
  }
  await prisma.brand.delete({ where: { id } });
  revalidatePath("/admin/znacky");
}
