import { prisma } from "@/lib/prisma";

export interface GiftOption {
  productId: string;
  name: string;
  image: string | null;
  /** Normal selling price — shown as "hodnota X" so the gift reads as worth something. */
  value: number;
}

/**
 * Products the customer may pick as a free gift once a GIFT-type Coupon is
 * applied (see CouponType in schema.prisma). Gifts ship from normal catalog
 * stock, so anything sold out drops out of the list on its own.
 */
export async function getGiftOptions(): Promise<GiftOption[]> {
  const products = await prisma.product.findMany({
    where: { giftEligible: true, visible: true, stock: { gt: 0 } },
    orderBy: { price: "desc" },
    select: {
      id: true,
      name: true,
      price: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    },
  });

  return products.map((p) => ({
    productId: p.id,
    name: p.name,
    image: p.images[0]?.url ?? null,
    value: Number(p.price),
  }));
}
