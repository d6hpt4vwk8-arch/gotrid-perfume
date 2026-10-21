import type { Coupon } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isSampleGiftCode, sampleGiftBlurb, sampleGiftTriggers, SAMPLE_GIFT_PREFIX, triggersFromFullSlugs, type GiftTrigger } from "@/lib/sample-gifts";

/**
 * The GIFT-type coupon currently worth announcing (benefits bar, homepage
 * hero slide) — active, not expired, not yet exhausted. Only ever one: if
 * several are active at once, the newest wins, so the site never shows two
 * conflicting gift promos at the same time.
 */
export async function getActiveGiftCoupon(): Promise<Coupon | null> {
  const coupon = await prisma.coupon.findFirst({
    where: {
      type: "GIFT",
      active: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
  return coupon && (coupon.usageLimit === null || coupon.usedCount < coupon.usageLimit)
    ? coupon
    : null;
}

export interface GiftOption {
  productId: string;
  name: string;
  nameSk: string | null;
  image: string | null;
  /** Normal selling price — shown as "hodnota X" so the gift reads as worth something. */
  value: number;
  /** One-line description shown next to a sample gift (sample-gifts.ts). */
  blurb?: string | null;
  blurbSk?: string | null;
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
      nameSk: true,
      price: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    },
  });

  return products.map((p) => ({
    productId: p.id,
    name: p.name,
    nameSk: p.nameSk,
    image: p.images[0]?.url ?? null,
    value: Number(p.price),
  }));
}

/** Gift triggers earned by a cart (or a single product): K-beauty and/or Arabic perfume present. */
export async function getGiftTriggersForProducts(productIds: string[]): Promise<GiftTrigger[]> {
  if (productIds.length === 0) return [];
  const rows = await prisma.productCategory.findMany({
    where: { productId: { in: productIds } },
    select: { category: { select: { fullSlug: true } } },
  });
  return triggersFromFullSlugs(rows.map((r) => r.category.fullSlug));
}

/**
 * Sample gifts (hidden GIFT- products) a customer can pick for free for the
 * given triggers — no coupon required. Out-of-stock samples drop out on their own;
 * the quantity left is deliberately never returned (owner's call: don't show it).
 */
export async function getSampleGiftOptions(triggers: GiftTrigger[]): Promise<GiftOption[]> {
  if (triggers.length === 0) return [];
  const products = await prisma.product.findMany({
    where: { code: { startsWith: SAMPLE_GIFT_PREFIX }, giftEligible: true, stock: { gt: 0 } },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      name: true,
      nameSk: true,
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    },
  });
  return products
    .filter((p) => sampleGiftTriggers(p.code).some((t) => triggers.includes(t)))
    .map((p) => ({
      productId: p.id,
      name: p.name,
      nameSk: p.nameSk,
      image: p.images[0]?.url ?? null,
      value: 0, // samples carry no stated value — the picker hides "v hodnotě" at 0
      blurb: sampleGiftBlurb(p.code)?.cs ?? null,
      blurbSk: sampleGiftBlurb(p.code)?.sk ?? null,
    }));
}

/** Server-side re-check at order time: is this sample gift allowed for this cart? */
export async function isSampleGiftAllowedForCart(giftCode: string, cartProductIds: string[]): Promise<boolean> {
  if (!isSampleGiftCode(giftCode)) return false;
  const triggers = await getGiftTriggersForProducts(cartProductIds);
  return sampleGiftTriggers(giftCode).some((t) => triggers.includes(t));
}
