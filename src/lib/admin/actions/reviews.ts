"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

const reviewSchema = z.object({
  rating: z.coerce.number().int().min(1, "Hodnocení musí být 1–5.").max(5, "Hodnocení musí být 1–5."),
  authorName: z.string().trim().max(100).optional(),
  text: z.string().trim().max(2000).optional(),
});

export async function createReview(productId: string, formData: FormData) {
  const parsed = reviewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Neplatná data recenze.");

  await prisma.review.create({
    data: {
      productId,
      rating: parsed.data.rating,
      authorName: parsed.data.authorName || null,
      text: parsed.data.text || null,
    },
  });

  revalidatePath(`/admin/produkty/${productId}`);
  revalidatePath("/");
}

export async function deleteReview(id: string) {
  const review = await prisma.review.delete({ where: { id } });
  revalidatePath(`/admin/produkty/${review.productId}`);
  revalidatePath("/");
}
