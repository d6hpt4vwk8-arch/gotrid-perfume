"use server";

import { unlink } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/require-admin";

export async function deleteProductImage(imageId: string) {
  await requireAdmin();
  const image = await prisma.productImage.delete({ where: { id: imageId } });

  // Best-effort local file cleanup — a missing file (already deleted, or a
  // remote URL from an older import) shouldn't fail the DB deletion above.
  if (image.url.startsWith("/uploads/")) {
    const filePath = path.join(process.cwd(), "public", image.url);
    await unlink(filePath).catch(() => {});
  }

  revalidatePath(`/admin/produkty/${image.productId}`);
}

export async function moveProductImage(imageId: string, direction: "up" | "down") {
  await requireAdmin();
  const image = await prisma.productImage.findUniqueOrThrow({ where: { id: imageId } });
  const siblings = await prisma.productImage.findMany({
    where: { productId: image.productId },
    orderBy: { sortOrder: "asc" },
  });

  const index = siblings.findIndex((s) => s.id === imageId);
  const swapWith = direction === "up" ? siblings[index - 1] : siblings[index + 1];
  if (!swapWith) return;

  await prisma.$transaction([
    prisma.productImage.update({ where: { id: image.id }, data: { sortOrder: swapWith.sortOrder } }),
    prisma.productImage.update({ where: { id: swapWith.id }, data: { sortOrder: image.sortOrder } }),
  ]);

  revalidatePath(`/admin/produkty/${image.productId}`);
}
