import { prisma } from "@/lib/prisma";
import { isConditionFlagged } from "@/lib/feeds/condition-flagged";
import { SK_ONLY_WHERE } from "@/lib/sk-visibility";

// Root categories grouped into the themes the "second order" email can pitch.
// The pitch follows what the buyer actually bought (owner's request,
// 2026-10-18): 173 of 207 recipients had never bought a perfume yet were
// offered "a discount on your next perfume". Home/car fragrance buyers stay
// with fragrance, perfume buyers get perfume, everyone else is recommended
// more of the category they bought from (cosmetics, household, dental, …).
const HOME_FRAGRANCE_ROOTS = ["Aroma Difuzéry", "Vonné svíčky", "Vůně do auta"];
const PERFUME_ROOTS = ["Parfémy", "Niche"];
// "Výprodej" is a clearance bucket, not a product kind — it never decides the theme.
const IGNORED_ROOTS = ["Výprodej"];

export type RecommendationTheme = "home_fragrance" | "perfume" | "category";

export interface RecommendedProduct {
  id: string;
  name: string;
  nameSk?: string | null;
  slug: string;
  price: number;
  imageUrl: string | null;
}

async function getRootCategory(categoryId: string): Promise<{ name: string; fullSlug: string } | null> {
  let current = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { name: true, fullSlug: true, parentId: true },
  });
  while (current?.parentId) {
    current = await prisma.category.findUnique({
      where: { id: current.parentId },
      select: { name: true, fullSlug: true, parentId: true },
    });
  }
  return current ? { name: current.name, fullSlug: current.fullSlug } : null;
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
 * order they've placed either way), works out which root category they buy
 * from most, and picks a handful of in-stock bestsellers from that same
 * category for the "second order" email. `ctaPath` is the storefront path of
 * that category so the button lands on relevant goods.
 */
export async function recommendProductsForBuyer(
  email: string,
  skOnly = false,
): Promise<{ theme: RecommendationTheme; products: RecommendedProduct[]; ctaPath: string; categoryName: string | null }> {
  const items = await prisma.orderItem.findMany({
    where: { order: { email: { equals: email, mode: "insensitive" } }, productId: { not: null }, isGift: false },
    select: { qty: true, product: { select: { id: true, categories: { select: { categoryId: true } } } } },
  });

  const purchasedProductIds = new Set<string>();
  const rootWeight = new Map<string, { name: string; fullSlug: string; weight: number }>();
  for (const item of items) {
    if (!item.product) continue;
    purchasedProductIds.add(item.product.id);
    const roots = new Map<string, { name: string; fullSlug: string }>();
    for (const { categoryId } of item.product.categories) {
      const root = await getRootCategory(categoryId);
      if (root && !IGNORED_ROOTS.includes(root.name)) roots.set(root.name, root);
    }
    for (const root of roots.values()) {
      const entry = rootWeight.get(root.name) ?? { ...root, weight: 0 };
      entry.weight += item.qty;
      rootWeight.set(root.name, entry);
    }
  }

  const primary = [...rootWeight.values()].sort((a, b) => b.weight - a.weight)[0] ?? null;
  const theme: RecommendationTheme = !primary
    ? "category"
    : PERFUME_ROOTS.includes(primary.name)
      ? "perfume"
      : HOME_FRAGRANCE_ROOTS.includes(primary.name)
        ? "home_fragrance"
        : "category";
  const targetRoots =
    theme === "perfume"
      ? PERFUME_ROOTS
      : theme === "home_fragrance"
        ? HOME_FRAGRANCE_ROOTS
        : primary
          ? [primary.name]
          : [];

  const categoryIds = (await Promise.all(targetRoots.map(getCategoryIdsUnderRoot))).flat();

  // Over-fetch and filter out testers/vintage/damaged-packaging items in JS
  // (isConditionFlagged's regex isn't expressible as a Prisma `where`) so a
  // "thank you, here's a discount" email never pitches an opened bottle.
  const candidates = categoryIds.length
    ? await prisma.product.findMany({
        where: {
          visible: true,
          stock: { gt: 0 },
          id: { notIn: [...purchasedProductIds] },
          categories: { some: { categoryId: { in: categoryIds } } },
          ...(skOnly ? SK_ONLY_WHERE : {}),
        },
        select: {
          id: true,
          name: true,
          nameSk: true,
          slug: true,
          price: true,
          isDefective: true,
          images: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } },
        },
        take: 200,
      })
    : [];

  // Rank by what the shop actually sold in the last 90 days (proven demand),
  // then by the usual own-stock/priority order — not "newest first".
  const sold = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: candidates.map((c) => c.id) },
      order: { createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }, status: { in: ["NEW", "PAID", "PROCESSING", "SHIPPED", "DELIVERED"] } },
    },
    _sum: { qty: true },
  });
  const soldMap = new Map(sold.map((s) => [s.productId, s._sum.qty ?? 0]));
  const ranked = candidates
    .filter((p) => !isConditionFlagged(p.name, p.isDefective))
    .sort((a, b) => (soldMap.get(b.id) ?? 0) - (soldMap.get(a.id) ?? 0))
    .slice(0, 3);

  const products: RecommendedProduct[] = ranked.map((p) => ({
    id: p.id,
    name: p.name,
    nameSk: p.nameSk,
    slug: p.slug,
    price: Number(p.price),
    imageUrl: p.images[0]?.url ?? null,
  }));

  // Buyer's items sit in no usable category (old catalog / clearance only) or
  // their category is out of stock — fall back to the shop's overall
  // bestsellers instead of sending an email with an empty product grid.
  const finalProducts = products.length
    ? products
    : await getPopularProductsExcluding([...purchasedProductIds], 3, skOnly);

  return {
    theme,
    categoryName: primary?.name ?? null,
    ctaPath:
      products.length && primary && theme === "category"
        ? `/kategorie/${primary.fullSlug}`
        : products.length && theme === "perfume"
          ? "/kategorie/parfemy"
          : "/",
    products: finalProducts,
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
  skOnly = false,
): Promise<RecommendedProduct[]> {
  const candidates = await prisma.product.findMany({
    where: { visible: true, stock: { gt: 0 }, id: { notIn: excludeIds }, ...(skOnly ? SK_ONLY_WHERE : {}) },
    select: {
      id: true,
      name: true,
      nameSk: true,
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
      nameSk: p.nameSk,
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
      nameSk: true,
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
      nameSk: p.nameSk,
      slug: p.slug,
      price: Number(p.price),
      imageUrl: p.images[0]?.url ?? null,
    }));
}
