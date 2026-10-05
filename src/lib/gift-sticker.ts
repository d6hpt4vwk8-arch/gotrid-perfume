import { prisma } from "@/lib/prisma";

/**
 * The "greeting sticker on the parcel" is offered free on perfume only for now,
 * so the checkout shows the option only when the cart contains a product in the
 * Parfémy category tree — and create-order.ts re-checks with the same function.
 */
export async function cartHasPerfume(productIds: string[]): Promise<boolean> {
  if (productIds.length === 0) return false;
  const count = await prisma.productCategory.count({
    where: {
      productId: { in: productIds },
      category: { OR: [{ fullSlug: "parfemy" }, { fullSlug: { startsWith: "parfemy/" } }] },
    },
  });
  return count > 0;
}
