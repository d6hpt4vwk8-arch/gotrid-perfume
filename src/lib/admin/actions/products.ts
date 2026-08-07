"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/slug";
import { notifyStockAlerts } from "@/lib/stock-alerts";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdmin } from "@/lib/admin/require-admin";

const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);

const productSchema = z.object({
  name: z.string().trim().min(1, "Název je povinný.").max(300),
  code: z.string().trim().min(1, "Kód je povinný.").max(100),
  ean: z.preprocess(emptyToUndefined, z.string().trim().max(50).optional()),
  brandId: z.preprocess(emptyToUndefined, z.string().optional()),
  categoryId: z.preprocess(emptyToUndefined, z.string().optional()),
  price: z.coerce.number().min(0, "Cena nesmí být záporná.").max(10_000_000),
  compareAtPrice: z.preprocess(
    emptyToUndefined,
    z.coerce.number().min(0).max(10_000_000).optional(),
  ),
  purchasePrice: z.coerce.number().min(0).max(10_000_000).default(0),
  vatRate: z.coerce.number().min(0, "DPH musí být mezi 0 a 100 %.").max(100),
  stock: z.coerce.number().int().min(0, "Sklad nemůže být záporný.").max(1_000_000),
  visible: z.coerce.boolean().default(false),
  description: z.preprocess(emptyToUndefined, z.string().max(20_000).optional()),
});

function parseProductForm(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = productSchema.safeParse({ ...raw, visible: formData.get("visible") === "on" });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Neplatná data produktu.");
  }
  return parsed.data;
}

async function setCategory(productId: string, categoryId: string | undefined) {
  await prisma.productCategory.deleteMany({ where: { productId } });
  if (categoryId) {
    await prisma.productCategory.create({ data: { productId, categoryId } });
  }
}

async function setScentFamilies(productId: string, formData: FormData) {
  const scentFamilyIds = formData.getAll("scentFamilyIds").filter((v): v is string => typeof v === "string");
  await prisma.productScentFamily.deleteMany({ where: { productId } });
  if (scentFamilyIds.length > 0) {
    await prisma.productScentFamily.createMany({
      data: scentFamilyIds.map((scentFamilyId) => ({ productId, scentFamilyId })),
      skipDuplicates: true,
    });
  }
}

async function setSkinTypes(productId: string, formData: FormData) {
  const skinTypeIds = formData.getAll("skinTypeIds").filter((v): v is string => typeof v === "string");
  await prisma.productSkinType.deleteMany({ where: { productId } });
  if (skinTypeIds.length > 0) {
    await prisma.productSkinType.createMany({
      data: skinTypeIds.map((skinTypeId) => ({ productId, skinTypeId })),
      skipDuplicates: true,
    });
  }
}

async function setConcerns(productId: string, formData: FormData) {
  const concernIds = formData.getAll("concernIds").filter((v): v is string => typeof v === "string");
  await prisma.productConcern.deleteMany({ where: { productId } });
  if (concernIds.length > 0) {
    await prisma.productConcern.createMany({
      data: concernIds.map((concernId) => ({ productId, concernId })),
      skipDuplicates: true,
    });
  }
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const data = parseProductForm(formData);
  const slug = `${slugify(data.name)}-${data.code.toLowerCase()}`;

  const product = await prisma.product.create({
    data: {
      name: data.name,
      code: data.code,
      slug,
      ean: data.ean,
      brandId: data.brandId,
      price: data.price,
      compareAtPrice: data.compareAtPrice,
      purchasePrice: data.purchasePrice,
      vatRate: data.vatRate,
      stock: data.stock,
      visible: data.visible,
      description: data.description,
    },
  });

  await setCategory(product.id, data.categoryId);
  await setScentFamilies(product.id, formData);
  await setSkinTypes(product.id, formData);
  await setConcerns(product.id, formData);
  revalidatePath("/admin/produkty");
  redirect(`/admin/produkty/${product.id}`);
}

export async function updateProduct(id: string, formData: FormData) {
  await requireAdmin();
  const data = parseProductForm(formData);
  const before = await prisma.product.findUniqueOrThrow({ where: { id } });

  const product = await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      code: data.code,
      ean: data.ean,
      brandId: data.brandId,
      price: data.price,
      compareAtPrice: data.compareAtPrice,
      purchasePrice: data.purchasePrice,
      vatRate: data.vatRate,
      stock: data.stock,
      visible: data.visible,
      description: data.description,
    },
  });

  await setCategory(id, data.categoryId);
  await setScentFamilies(id, formData);
  await setSkinTypes(id, formData);
  await setConcerns(id, formData);

  if (Number(before.price) !== Number(product.price)) {
    await logAdminActivity({
      action: "product.price_change",
      entityType: "Product",
      entityId: id,
      detail: `${product.name}: ${Number(before.price)} Kč → ${Number(product.price)} Kč`,
    });
  }
  if (before.stock !== product.stock) {
    await logAdminActivity({
      action: "product.stock_change",
      entityType: "Product",
      entityId: id,
      detail: `${product.name}: ${before.stock} ks → ${product.stock} ks`,
    });
  }
  if (before.stock <= 0 && product.stock > 0) {
    void notifyStockAlerts(product).catch((err) =>
      console.error(`[stock-alert] notify failed for ${product.slug}`, err),
    );
  }

  revalidatePath("/admin/produkty");
  revalidatePath(`/admin/produkty/${id}`);
}

export async function deleteProduct(id: string) {
  await requireAdmin();
  const product = await prisma.product.delete({ where: { id } });
  await logAdminActivity({
    action: "product.delete",
    entityType: "Product",
    entityId: id,
    detail: `Smazán produkt ${product.name} (${product.code})`,
  });
  revalidatePath("/admin/produkty");
  redirect("/admin/produkty");
}

export async function toggleProductVisible(id: string, visible: boolean) {
  await requireAdmin();
  await prisma.product.update({ where: { id }, data: { visible } });
  revalidatePath("/admin/produkty");
}
