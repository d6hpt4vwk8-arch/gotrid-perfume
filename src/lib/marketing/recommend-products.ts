import { prisma } from "@/lib/prisma";
import { isConditionFlagged } from "@/lib/feeds/condition-flagged";

// Root categories that mean "this customer buys home/car fragrance, not
// perfume" — used to decide whether the "second order" email pitches
// perfumes or diffusers/candles instead (customer's own request: someone
// who only ever bought a diffuser rarely wants a perfume upsell).
const HOME_FRAGRANCE_ROOTS = ["Aroma Difuzéry", "Vonné svíčky", "Vůně do auta"];
const PERFUME_ROOTS = ["Parfémy", "Niche"];

export type RecommendationTheme = "home_fragrance" | "perfume";

export interface RecommendedProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl: string | null;
}

async function getRootCategoryName(categoryId: string): Promise<string | null> {
  let current = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { name: true, parentId: true },
  });
  while (current?.parentId) {
    current = await prisma.category.findUnique({
      where: { id: current.parentId },
      select: { name: true, parentId: true },
    });
  }
  return current?.name ?? null;
}

async function getCategoryIdsUnderRoot(rootName: string): Promise<string[]> {
  const root = await prisma.category.findFirst({
    where: { name: rootName, parentId: null },
    select: { fullSlug: true },
  });
  if (!root) return [];
  const categories = await prisma.category.findMany({
    where: { OR: [{ fullSlug: root.fullSlug }, { fullSlug: { startsWith: `${root.fullSlug}/` } }] },
    select: { id: true },
  });
  return categories.map((c) => c.id);
}

/**
 * Looks at what a buyer has ordered before (matched by email, not
 * customerId — guests never get a customerId, but their email is on every
 * order they've placed either way) and picks a theme + a handful of
 * in-stock products to recommend in the "second order" email — perfumes by
 * default, or home/car fragrance if that's the only thing they've bought
 * so far.
 */
export async function recommendProductsForBuyer(
  email: string,
): Promise<{ theme: RecommendationTheme; products: RecommendedProduct[] }> {
  const items = await prisma.orderItem.findMany({
    where: { order: { email: { equals: email, mode: "insensitive" } }, productId: { not: null } },
    select: { product: { select: { id: true, categories: { select: { categoryId: true }, take: 1 } } } },
  });

  const purchasedProductIds = new Set(items.map((i) => i.product!.id));
  const rootNames = new Set<string>();
  for (const item of items) {
    const categoryId = item.product?.categories[0]?.categoryId;
    if (!categoryId) continue;
    const root = await getRootCategoryName(categoryId);
    if (root) rootNames.add(root);
  }

  const isHomeFragranceOnly =
    rootNames.size > 0 && [...rootNames].every((name) => HOME_FRAGRANCE_ROOTS.includes(name));
  const theme: RecommendationTheme = isHomeFragranceOnly ? "home_fragrance" : "perfume";
  const targetRoots = isHomeFragranceOnly ? HOME_FRAGRANCE_ROOTS : PERFUME_ROOTS;

  const categoryIdLists = await Promise.all(targetRoots.map(getCategoryIdsUnderRoot));
  const categoryIds = categoryIdLists.flat();

  // Over-fetch and filter out testers/vintage/damaged-packaging items in JS
  // (isConditionFlagged's regex isn't expressible as a Prisma `where`) so a
  // "thank you, here's a discount" email never pitches an opened bottle.
  const candidates = await prisma.product.findMany({
    where: {
      visible: true,
      stock: { gt: 0 },
      id: { notIn: [...purchasedProductIds] },
      categories: { some: { categoryId: { in: categoryIds } } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      isDefective: true,
      images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const products = candidates.filter((p) => !isConditionFlagged(p.name, p.isDefective)).slice(0, 3);

  return {
    theme,
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      imageUrl: p.images[0]?.url ?? null,
    })),
  };
}

/**
 * Generic "you might also like" cross-sell for emails that aren't tied to
 * purchase history (order confirmation, abandoned checkout) — just the
 * shop's own priority-ranked in-stock catalog, minus whatever the customer
 * already has in their order/cart so the same product never repeats.
 */
export async function getPopularProductsExcluding(
  excludeIds: string[],
  take = 3,
): Promise<RecommendedProduct[]> {
  const candidates = await prisma.product.findMany({
    where: { visible: true, stock: { gt: 0 }, id: { notIn: excludeIds } },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      isDefective: true,
      images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
    },
    orderBy: [{ ownStock: "desc" }, { priority: "desc" }],
    take: 20,
  });

  return candidates
    .filter((p) => !isConditionFlagged(p.name, p.isDefective))
    .slice(0, take)
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      imageUrl: p.images[0]?.url ?? null,
    }));
}

/**
 * "Similar products" cross-sell for the stock-alert email — other in-stock
 * items sharing a category with the one that just came back, so someone who
 * was waiting on a sold-out scent sees close alternatives too.
 */
export async function getSimilarProducts(productId: string, take = 3): Promise<RecommendedProduct[]> {
  const categoryIds = (
    await prisma.productCategory.findMany({ where: { productId }, select: { categoryId: true } })
  ).map((c) => c.categoryId);
  if (categoryIds.length === 0) return [];

  const candidates = await prisma.product.findMany({
    where: {
      visible: true,
      stock: { gt: 0 },
      id: { not: productId },
      categories: { some: { categoryId: { in: categoryIds } } },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      isDefective: true,
      images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
    },
    orderBy: [{ ownStock: "desc" }, { priority: "desc" }],
    take: 20,
  });

  return candidates
    .filter((p) => !isConditionFlagged(p.name, p.isDefective))
    .slice(0, take)
    .map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: Number(p.price),
      imageUrl: p.images[0]?.url ?? null,
    }));
}
