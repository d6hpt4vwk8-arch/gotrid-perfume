"use server";

import { z } from "zod";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { requireAdmin } from "@/lib/admin/require-admin";

const categorySchema = z.object({
  name: z.string().trim().min(1, "Název je povinný.").max(200),
  sortOrder: z.coerce.number().int().min(-1000).max(1000).default(0),
});

export async function createCategory(formData: FormData) {
  await requireAdmin();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Neplatná data.");
  const { name, sortOrder } = parsed.data;
  const parentId = String(formData.get("parentId") ?? "").trim() || null;

  const slug = slugify(name);
  let fullSlug = slug;
  if (parentId) {
    const parent = await prisma.category.findUniqueOrThrow({ where: { id: parentId } });
    fullSlug = `${parent.fullSlug}/${slug}`;
  }

  await prisma.category.create({
    data: { name, slug, fullSlug, parentId, sortOrder },
  });

  revalidatePath("/admin/kategorie");
  revalidateTag("category-nav");
  redirect("/admin/kategorie");
}

// Renaming keeps the existing slug/fullSlug (and therefore the public URL and
// any children's materialized paths) stable — only display fields change.
export async function updateCategory(id: string, formData: FormData) {
  await requireAdmin();
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Neplatná data.");
  const { name, sortOrder } = parsed.data;
  const hidden = formData.get("hidden") === "on";

  await prisma.category.update({
    where: { id },
    data: { name, sortOrder, hidden },
  });

  revalidatePath("/admin/kategorie");
  revalidateTag("category-nav");
}

export async function deleteCategory(id: string) {
  await requireAdmin();
  const [childCount, productCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.productCategory.count({ where: { categoryId: id } }),
  ]);

  if (childCount > 0) throw new Error("Kategorie má podkategorie — nejdřív je přesuňte nebo smažte.");
  if (productCount > 0) throw new Error("Ke kategorii jsou přiřazeny produkty — nejdřív je přeřaďte.");

  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/kategorie");
  revalidateTag("category-nav");
}
